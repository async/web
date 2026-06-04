import { createBackendDriver } from './create-backend-driver.ts';
import { createDelayController } from './create-delay-controller.ts';
import { createEdgeCache } from './create-edge-cache.ts';
import { createEdgeDriver } from './create-edge-driver.ts';
import { createFakeHistory } from './create-fake-history.ts';
import { createFakeLocation } from './create-fake-location.ts';
import { createFakeNavigation } from './create-fake-navigation.ts';
import { createFakeServiceWorker } from './create-fake-service-worker.ts';
import { createMemoryFileSystem } from './create-memory-file-system.ts';
import { createNetworkDriver } from './create-network-driver.ts';
import { composeWebRuntime, finalWebRuntimeHandler } from './routes.ts';
import {
  createWebRuntimeEnvironmentRuntime,
  createWebRuntimeEnvironmentRuntimes
} from './platform/create-platform.ts';
import { createPipelineTracer } from './create-pipeline-tracer.ts';
import { recordStreamLifecycle } from './create-stream-delay-transform.ts';
import { createTerminalRuntime } from './create-terminal-runtime.ts';
import type {
  BackendLayerConfig,
  DelayBoundary,
  DelayController,
  EdgeLayerConfig,
  EdgeCacheConfig,
  WebRuntime,
  WebRuntimeAppDefinition,
  WebRuntimeConfig,
  WebRuntimeContext,
  WebRuntimeCreateOptions,
  WebRuntimeCookieJar,
  WebRuntimeEnvironmentExecutionConfig,
  WebRuntimeEnvironmentMap,
  WebRuntimeEnvironmentRuntime,
  WebRuntimeEnv,
  WebRuntimePlatformFetchHandler,
  WebRuntimeProxyHooks,
  WebRuntimeRouteContext,
  NetworkLayerConfig,
  PipelineTraceController,
  ProxyHook
} from './types.ts';

export async function createWebRuntime(
  config: WebRuntimeConfig | WebRuntimeAppDefinition,
  options: WebRuntimeCreateOptions = {}
): Promise<WebRuntime> {
  if (isWebRuntimeAppDefinition(config)) {
    return createWebRuntimeFromAppDefinition(config, options);
  }

  const legacyConfig = config;
  const origin = new URL(config.origin).origin;
  const trace = createPipelineTracer();
  const edgeConfig = config.pipeline.edge ?? defaultEdgeConfig();
  const context = createWebRuntimeContext({
    origin,
    files: config.files,
    trace,
    edgeCacheConfig: edgeConfig.kind === 'fake' ? edgeConfig.cache : undefined
  });
  let dispatchPlatformFetch: WebRuntimePlatformFetchHandler = async () => {
    throw new Error('WebRuntime platform fetch is not ready');
  };
  const environments = createWebRuntimeEnvironmentRuntimes({
    origin,
    frontendLocation: context.location,
    config: config.environments,
    platform: config.platform,
    fetch(environment, input, init) {
      return dispatchPlatformFetch(environment, input, init);
    }
  });
  bindWebRuntimeContextEnvironment(context, environments.frontend, environments);
  const delay = createDelayController(config.delay, trace);
  const networkConfig = config.pipeline.network ?? defaultNetworkConfig();
  const env: WebRuntimeEnv = {
    NODE_ENV: 'test',
    ...config.env
  };
  const edgeEnv: WebRuntimeEnv = {
    ...env,
    ...config.edgeEnv
  };
  const backendDriver = createBackendDriver({
    config: config.pipeline.backend,
    app: config.app,
    env,
    context
  });
  const edgeDriver = createEdgeDriver({
    config: edgeConfig,
    context,
    env: edgeEnv,
    trace
  });
  const networkDriver = createNetworkDriver({
    origin,
    config: networkConfig,
    network: config.network
  });
  const serviceWorker = createFakeServiceWorker();
  if (config.pipeline.serviceWorker.kind === 'fake') {
    for (const route of config.pipeline.serviceWorker.routes ?? []) {
      serviceWorker.route(route.pattern, route.handler);
    }
  }
  let running = false;
  const terminal = createTerminalRuntime({
    fs: context.fs,
    origin,
    setRunning(value) {
      running = value;
    }
  });

  async function backendStage(request: Request): Promise<Response> {
    return withEnvironment(context, environments.backend, async () => {
      record(trace, 'backend:request', request);
      await callHook(config.proxyHooks?.onBackendRequest, 'backend:request', context, request);
      await delay.delayBoundaryRequest('backend', request);
      try {
        let response = await backendDriver.fetch(request);
        await delay.delayBoundaryResponse('backend', request, response);
        response = delayResponseStream(delay, 'backend', request, response);
        response = maybeTraceStream(trace, request, response);
        record(trace, 'backend:response', request, response);
        await callHook(config.proxyHooks?.onBackendResponse, 'backend:response', context, request, response);
        return response;
      } catch (error) {
        record(trace, 'error', request, undefined, {
          boundary: 'backend',
          message: error instanceof Error ? error.message : String(error)
        });
        const response = new Response('Internal WebRuntime backend error', {
          status: 500
        });
        record(trace, 'backend:response', request, response);
        return response;
      }
    });
  }

  async function edgeStage(request: Request): Promise<Response> {
    return withEnvironment(context, environments.edge, async () => {
      record(trace, 'edge:request', request);
      await callHook(config.proxyHooks?.onEdgeRequest, 'edge:request', context, request);
      await delay.delayBoundaryRequest('edge', request);
      let response = await edgeDriver.fetch(request, (nextRequest = request) => backendStage(nextRequest));
      await delay.delayBoundaryResponse('edge', request, response);
      response = delayResponseStream(delay, 'edge', request, response);
      record(trace, 'edge:response', request, response);
      await callHook(config.proxyHooks?.onEdgeResponse, 'edge:response', context, request, response);
      return response;
    });
  }

  async function networkStage(request: Request): Promise<Response> {
    record(trace, 'network:request', request);
    await callHook(config.proxyHooks?.onNetworkRequest, 'network:request', context, request);
    await delay.delayBoundaryRequest('network', request);
    let response: Response;
    const requestUrl = new URL(request.url);
    if (networkConfig.kind === 'web-runtime-network' && requestUrl.origin !== origin) {
      record(trace, 'web-runtime-network:request', request);
      await delay.delayBoundaryRequest('web-runtime-network', request);
      response = await networkDriver.fetch(request, () => edgeStage(request));
      await delay.delayBoundaryResponse('web-runtime-network', request, response);
      record(trace, 'web-runtime-network:response', request, response);
    } else {
      response = await networkDriver.fetch(request, () => edgeStage(request));
    }
    await delay.delayBoundaryResponse('network', request, response);
    response = delayResponseStream(delay, 'network', request, response);
    record(trace, 'network:response', request, response);
    await callHook(config.proxyHooks?.onNetworkResponse, 'network:response', context, request, response);
    return response;
  }

  async function serviceWorkerStage(request: Request): Promise<Response> {
    return withEnvironment(context, environments.serviceWorker, async () => {
      record(trace, 'service-worker:request', request);
      await callHook(config.proxyHooks?.onServiceWorkerRequest, 'service-worker:request', context, request);
      await delay.delayBoundaryRequest('service-worker', request);
      let response = legacyConfig.pipeline.serviceWorker.kind === 'fake'
        ? await serviceWorker.dispatchFetch(request, context, () => networkStage(request))
        : await networkStage(request);
      await delay.delayBoundaryResponse('service-worker', request, response);
      response = delayResponseStream(delay, 'service-worker', request, response);
      record(trace, 'service-worker:response', request, response);
      await callHook(config.proxyHooks?.onServiceWorkerResponse, 'service-worker:response', context, request, response);
      return response;
    });
  }

  async function fetchThroughPipeline(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    return environments.frontend.platform.fetch(input, init);
  }

  async function frontendStage(request: Request): Promise<Response> {
    return withEnvironment(context, environments.frontend, async () => {
      record(trace, 'frontend:request', request);
      await callHook(config.proxyHooks?.onFrontendRequest, 'frontend:request', context, request);
      await delay.delayBoundaryRequest('frontend', request);
      let response = await serviceWorkerStage(request);
      await delay.delayBoundaryResponse('frontend', request, response);
      response = delayResponseStream(delay, 'frontend', request, response);
      record(trace, 'frontend:response', request, response);
      await callHook(config.proxyHooks?.onFrontendResponse, 'frontend:response', context, request, response);
      return response;
    });
  }

  dispatchPlatformFetch = async (environment, input, init) => {
    let request = toWebRuntimeRequest(input, init, environment.location.href);
    request = applyRequestCookies(request, environment.platform.cookies);
    return runAbortable(request.signal, async () => {
      let response: Response;
      if (environment.name === 'frontend' || environment.name === 'test') {
        response = await frontendStage(request);
      } else if (environment.name === 'serviceWorker' || environment.name === 'backend') {
        response = await networkStage(request);
      } else {
        response = new URL(request.url).origin === origin
          ? await backendStage(request)
          : await networkStage(request);
      }
      storeResponseCookies(request, response, environment.platform.cookies);
      return response;
    });
  };

  const web: WebRuntime = {
    origin,
    fs: context.fs,
    location: context.location,
    history: context.history,
    navigation: context.navigation,
    platform: environments.frontend.platform,
    environments,
    trace,
    terminal,
    edge: {
      cache: context.edgeCache,
      region: edgeConfig.kind === 'fake' ? edgeConfig.region ?? 'local' : 'local'
    },
    frontend: {
      kind: config.pipeline.frontend.kind,
      fetch: fetchThroughPipeline,
      navigate(url) {
        return web.navigate(url);
      },
      reload() {
        return web.reload();
      }
    },
    fetch: fetchThroughPipeline,
    async navigate(url) {
      const result = context.navigation.navigate(url);
      await result.finished;
      return fetchThroughPipeline(context.location.href);
    },
    async reload() {
      context.location.reload();
      return fetchThroughPipeline(context.location.href);
    },
    async reset() {
      trace.clear();
      running = false;
      terminal.clear();
      await context.edgeCache.purgeAll();
      for (const environment of Object.values(environments)) {
        environment.reset();
      }
      resetFakeHistory(context.history, `${origin}/`);
      bindWebRuntimeContextEnvironment(context, environments.frontend, environments);
      for (const path of await context.fs.readdir()) {
        await context.fs.deleteFile(path);
      }
      for (const [path, value] of Object.entries(config.files ?? {})) {
        await context.fs.writeFile(path, value);
      }
    }
  };

  void running;
  return web;
}

async function createWebRuntimeFromAppDefinition(
  config: WebRuntimeAppDefinition,
  options: WebRuntimeCreateOptions
): Promise<WebRuntime> {
  validateWebRuntimeAppDefinition(config);
  const origin = new URL(config.origin).origin;
  const trace = createPipelineTracer();
  const context = createWebRuntimeContext({
    origin,
    files: collectWebRuntimeAppFiles(config),
    trace
  });
  let dispatchPlatformFetch: WebRuntimePlatformFetchHandler = async () => {
    throw new Error('WebRuntime route fetch is not ready');
  };
  const environments = createWebRuntimeEnvironmentRuntimes({
    origin,
    frontendLocation: context.location,
    platform: config.platform,
    fetch(environment, input, init) {
      return dispatchPlatformFetch(environment, input, init);
    }
  });
  bindWebRuntimeContextEnvironment(context, environments.frontend, environments);
  const delay = createDelayController(config.delay, trace);
  const env: WebRuntimeEnv = {
    NODE_ENV: 'test',
    ...config.env
  };
  const appPlatforms = createWebRuntimeAppPlatformRuntimes({
    config,
    options,
    origin,
    fetch(environment, input, init) {
      return dispatchPlatformFetch(environment, input, init);
    }
  });
  const frontendRuntime = appPlatforms.get('frontend') ?? environments.frontend;
  bindWebRuntimeContextEnvironment(context, frontendRuntime, environments);
  const terminal = createTerminalRuntime({
    fs: context.fs,
    origin,
    setRunning() {}
  });
  const routeContext = context as WebRuntimeRouteContext;
  routeContext.route = {
    params: {}
  };
  routeContext.fetchApp = fetchRegisteredApp;
  const router = composeWebRuntime(config.routes);

  async function fetchRegisteredApp(name: string, request: Request): Promise<Response> {
    const registered = config.apps[name];
    if (!registered) {
      return new Response(`WebRuntime app is not registered: ${name}`, {
        status: 502
      });
    }
    const environment = appPlatforms.get(name) ?? (name === 'frontend' ? environments.frontend : environments.backend);
    return withEnvironment(context, environment, async () => {
      if (name !== 'frontend') {
        record(trace, 'backend:request', request, undefined, {
          app: name
        });
      }
      try {
        const appRequest = environment.execution.mode === 'iframe'
          ? await bufferRequestForRuntime(request)
          : request;
        let response = await registered.app.fetch(appRequest, env, context);
        if (environment.execution.mode === 'iframe') {
          response = await bufferResponseForRuntime(response);
        }
        if (name !== 'frontend') {
          record(trace, 'backend:response', request, response, {
            app: name
          });
        }
        return response;
      } catch (error) {
        record(trace, 'error', request, undefined, {
          app: name,
          message: error instanceof Error ? error.message : String(error)
        });
        return new Response('Internal WebRuntime app error', {
          status: 500
        });
      }
    });
  }

  async function dispatchRoutes(request: Request): Promise<Response> {
    routeContext.route = {
      params: {}
    };
    return router(request, routeContext, finalWebRuntimeHandler);
  }

  dispatchPlatformFetch = async (environment, input, init) => {
    let request = toWebRuntimeRequest(input, init, environment.location.href);
    request = applyRequestCookies(request, environment.platform.cookies);
    return runAbortable(request.signal, async () => {
      record(trace, 'frontend:request', request);
      await callHook(config.proxyHooks?.onFrontendRequest, 'frontend:request', context, request);
      await delay.delayBoundaryRequest('frontend', request);
      let response = await dispatchRoutes(request);
      await delay.delayBoundaryResponse('frontend', request, response);
      response = delayResponseStream(delay, 'frontend', request, response);
      record(trace, 'frontend:response', request, response);
      await callHook(config.proxyHooks?.onFrontendResponse, 'frontend:response', context, request, response);
      storeResponseCookies(request, response, environment.platform.cookies);
      return response;
    });
  };

  async function fetchThroughRoutes(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    return frontendRuntime.platform.fetch(input, init);
  }

  const web: WebRuntime = {
    origin,
    fs: context.fs,
    location: context.location,
    history: context.history,
    navigation: context.navigation,
    platform: frontendRuntime.platform,
    environments,
    trace,
    terminal,
    edge: {
      cache: context.edgeCache,
      region: 'local'
    },
    frontend: {
      kind: 'headless',
      fetch: fetchThroughRoutes,
      navigate(url) {
        return web.navigate(url);
      },
      reload() {
        return web.reload();
      }
    },
    fetch: fetchThroughRoutes,
    async navigate(url) {
      const result = context.navigation.navigate(url);
      await result.finished;
      return fetchThroughRoutes(context.location.href);
    },
    async reload() {
      context.location.reload();
      return fetchThroughRoutes(context.location.href);
    },
    async reset() {
      trace.clear();
      terminal.clear();
      await context.edgeCache.purgeAll();
      for (const environment of Object.values(environments)) {
        environment.reset();
      }
      for (const environment of appPlatforms.values()) {
        environment.reset();
      }
      resetFakeHistory(context.history, `${origin}/`);
      bindWebRuntimeContextEnvironment(context, frontendRuntime, environments);
      for (const path of await context.fs.readdir()) {
        await context.fs.deleteFile(path);
      }
      for (const [path, value] of Object.entries(collectWebRuntimeAppFiles(config))) {
        await context.fs.writeFile(path, value);
      }
    }
  };

  return web;
}

export function createWebRuntimeContext(options: {
  origin: string;
  files?: Record<string, string>;
  trace?: PipelineTraceController;
  edgeCacheConfig?: EdgeCacheConfig;
}): WebRuntimeContext {
  const origin = new URL(options.origin).origin;
  const fs = createMemoryFileSystem(options.files);
  const location = createFakeLocation(`${origin}/`);
  const history = createFakeHistory(location);
  const navigation = createFakeNavigation(location, history);
  const trace = options.trace ?? createPipelineTracer();
  const edgeCache = createEdgeCache(options.edgeCacheConfig);
  const waitUntilPromises = new Set<Promise<unknown>>();
  const environmentState = createEnvironmentState(options.origin, location);

  return {
    fs,
    location,
    history,
    navigation,
    get environment() {
      return environmentState.current;
    },
    get environments() {
      return environmentState.environments;
    },
    get platform() {
      return environmentState.current.platform;
    },
    trace,
    edgeCache,
    waitUntil(promise) {
      waitUntilPromises.add(promise);
      promise.finally(() => {
        waitUntilPromises.delete(promise);
      });
    },
    [webRuntimeEnvironmentState]: environmentState
  } as WebRuntimeContext;
}

function resetFakeHistory(history: WebRuntimeContext['history'], url: string): void {
  const resettable = history as WebRuntimeContext['history'] & {
    reset?: (url: string, state?: unknown) => void;
  };
  if (resettable.reset) {
    resettable.reset(url, null);
    return;
  }
  history.replaceState(null, '', url);
}

function defaultNetworkConfig(): NetworkLayerConfig {
  return {
    kind: 'blocked'
  };
}

function defaultEdgeConfig(): EdgeLayerConfig {
  return {
    kind: 'bypass'
  };
}

function isWebRuntimeAppDefinition(config: WebRuntimeConfig | WebRuntimeAppDefinition): config is WebRuntimeAppDefinition {
  return 'apps' in config && 'routes' in config;
}

function validateWebRuntimeAppDefinition(config: WebRuntimeAppDefinition): void {
  if (Object.keys(config.apps).length === 0) {
    throw new Error('WebRuntime requires at least one registered app');
  }
  for (const [name, app] of Object.entries(config.apps)) {
    if (!app.app || typeof app.app.fetch !== 'function') {
      throw new Error(`WebRuntime app requires a fetch handler: ${name}`);
    }
    if (app.basePath && app.baseUrl) {
      throw new Error(`WebRuntime app cannot define both basePath and baseUrl: ${name}`);
    }
    const platform = app.platform ? config.platforms?.[app.platform] : undefined;
    if (platform?.basePath && platform.baseUrl) {
      throw new Error(`WebRuntime platform cannot define both basePath and baseUrl: ${app.platform}`);
    }
    if (app.runtime && config.runtimes && !config.runtimes[app.runtime]) {
      throw new Error(`WebRuntime app references an unknown runtime: ${app.runtime}`);
    }
  }
  for (const [name, platform] of Object.entries(config.platforms ?? {})) {
    if (platform.basePath && platform.baseUrl) {
      throw new Error(`WebRuntime platform cannot define both basePath and baseUrl: ${name}`);
    }
    if (platform.baseUrl) {
      new URL(platform.baseUrl);
    }
  }
}

function createWebRuntimeAppPlatformRuntimes(options: {
  config: WebRuntimeAppDefinition;
  options: WebRuntimeCreateOptions;
  origin: string;
  fetch: WebRuntimePlatformFetchHandler;
}): Map<string, WebRuntimeEnvironmentRuntime> {
  const runtimes = new Map<string, WebRuntimeEnvironmentRuntime>();
  for (const [name, app] of Object.entries(options.config.apps)) {
    const baseUrl = resolveWebRuntimeAppBaseUrl(options.config, name);
    const execution = resolveWebRuntimeAppRuntime(options.config, options.options, name, baseUrl);
    const location = createFakeLocation(execution.location ?? baseUrl);
    runtimes.set(name, createWebRuntimeEnvironmentRuntime({
      name: app.platform ?? name,
      origin: options.origin,
      execution,
      location,
      platform: options.config.platform,
      fetch: options.fetch
    }));
  }
  return runtimes;
}

function resolveWebRuntimeAppRuntime(
  config: WebRuntimeAppDefinition,
  options: WebRuntimeCreateOptions,
  name: string,
  baseUrl: string
): WebRuntimeEnvironmentExecutionConfig {
  const app = config.apps[name]!;
  const runtimeName = app.runtime ?? name;
  const runtime = options.runtimes?.[runtimeName] ?? config.runtimes?.[runtimeName] ?? {
    mode: 'same-realm' as const
  };
  if (runtime.mode === 'iframe') {
    return {
      mode: 'iframe',
      location: runtime.location ?? baseUrl,
      sandbox: runtime.sandbox
    };
  }
  return {
    mode: 'same-realm',
    location: runtime.location ?? baseUrl
  };
}

function resolveWebRuntimeAppBaseUrl(config: WebRuntimeAppDefinition, name: string): string {
  const app = config.apps[name]!;
  const platform = app.platform ? config.platforms?.[app.platform] : config.platforms?.[name];
  const baseUrl = app.baseUrl ?? platform?.baseUrl;
  if (baseUrl) {
    return new URL(baseUrl).href;
  }
  const basePath = app.basePath ?? platform?.basePath ?? (name === 'frontend' ? '/' : `/${name}/`);
  return new URL(basePath, config.origin).href;
}

function collectWebRuntimeAppFiles(config: WebRuntimeAppDefinition): Record<string, string> {
  return Object.values(config.apps).reduce<Record<string, string>>((files, app) => {
    return {
      ...files,
      ...app.files
    };
  }, {
    ...config.files
  });
}

async function bufferRequestForRuntime(request: Request): Promise<Request> {
  if (!request.body || request.method === 'GET' || request.method === 'HEAD') {
    return new Request(request);
  }
  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers: request.headers,
    body: await request.arrayBuffer(),
    duplex: 'half'
  };
  return new Request(request.url, init);
}

async function bufferResponseForRuntime(response: Response): Promise<Response> {
  const body = response.body ? await response.arrayBuffer() : null;
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

function toWebRuntimeRequest(input: string | URL | Request, init: RequestInit | undefined, base: string): Request {
  if (input instanceof Request) {
    return init ? new Request(input, init) : new Request(input);
  }
  return new Request(new URL(input, base), init);
}

function record(
  trace: PipelineTraceController,
  boundary: Parameters<PipelineTraceController['record']>[0]['boundary'],
  request: Request,
  response?: Response,
  detail?: unknown
): void {
  trace.record({
    boundary,
    method: request.method,
    url: request.url,
    status: response?.status,
    detail
  });
}

async function callHook(
  hook: ProxyHook | undefined,
  boundary: Parameters<PipelineTraceController['record']>[0]['boundary'],
  context: WebRuntimeContext,
  request?: Request,
  response?: Response
): Promise<void> {
  await hook?.({
    boundary,
    request,
    response,
    context
  });
}

function maybeTraceStream(
  trace: PipelineTraceController,
  request: Request,
  response: Response
): Response {
  if (!response.body || response.headers.get('x-web-runtime-stream') !== '1') {
    return response;
  }
  return recordStreamLifecycle(trace, request, response);
}

function delayResponseStream(
  delay: DelayController,
  boundary: DelayBoundary,
  request: Request,
  response: Response
): Response {
  if (!response.body) {
    return response;
  }
  const body = delay.delayStream(boundary, request, response.body);
  if (body === response.body) {
    return response;
  }
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

const webRuntimeEnvironmentState = Symbol('webruntime.environmentState');

interface WebRuntimeEnvironmentState {
  current: WebRuntimeEnvironmentRuntime;
  environments: WebRuntimeEnvironmentMap;
}

function createEnvironmentState(
  origin: string,
  location: WebRuntimeContext['location']
): WebRuntimeEnvironmentState {
  const testEnvironment = createWebRuntimeEnvironmentRuntime({
    name: 'test',
    origin,
    location,
    fetch(_environment, input, init) {
      return fetch(toWebRuntimeRequest(input, init, location.href));
    }
  });
  return {
    current: testEnvironment,
    environments: {
      frontend: testEnvironment,
      serviceWorker: testEnvironment,
      edge: testEnvironment,
      backend: testEnvironment
    }
  };
}

function bindWebRuntimeContextEnvironment(
  context: WebRuntimeContext,
  current: WebRuntimeEnvironmentRuntime,
  environments: WebRuntimeEnvironmentMap
): void {
  const state = getEnvironmentState(context);
  state.current = current;
  state.environments = environments;
}

async function withEnvironment<T>(
  context: WebRuntimeContext,
  environment: WebRuntimeEnvironmentRuntime,
  run: () => Promise<T>
): Promise<T> {
  const state = getEnvironmentState(context);
  const previous = state.current;
  state.current = environment;
  try {
    return await run();
  } finally {
    state.current = previous;
  }
}

function getEnvironmentState(context: WebRuntimeContext): WebRuntimeEnvironmentState {
  return (context as WebRuntimeContext & {
    [webRuntimeEnvironmentState]: WebRuntimeEnvironmentState;
  })[webRuntimeEnvironmentState];
}

async function runAbortable<T>(signal: AbortSignal, run: () => Promise<T>): Promise<T> {
  if (signal.aborted) {
    throw createAbortError(signal.reason);
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      reject(createAbortError(signal.reason));
    };
    signal.addEventListener('abort', onAbort, {
      once: true
    });
    run().then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', onAbort);
    });
  });
}

function createAbortError(reason: unknown): Error | DOMException {
  if (reason instanceof Error || reason instanceof DOMException) {
    return reason;
  }
  return new DOMException(
    typeof reason === 'string' ? reason : 'The operation was aborted.',
    'AbortError'
  );
}

function applyRequestCookies(request: Request, cookies: WebRuntimeCookieJar): Request {
  if (request.credentials === 'omit' || request.headers.has('cookie')) {
    return request;
  }
  const cookieHeader = cookies.getCookieHeader(request.url);
  if (!cookieHeader) {
    return request;
  }
  const headers = new Headers(request.headers);
  headers.set('cookie', cookieHeader);
  return new Request(request, {
    headers
  });
}

function storeResponseCookies(
  request: Request,
  response: Response,
  cookies: WebRuntimeCookieJar
): void {
  if (request.credentials === 'omit') {
    return;
  }
  const setCookie = getSetCookieHeaders(response.headers);
  if (setCookie.length > 0) {
    cookies.setCookie(request.url, setCookie);
  }
}

function getSetCookieHeaders(headers: Headers): string[] {
  const headersWithSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof headersWithSetCookie.getSetCookie === 'function') {
    return headersWithSetCookie.getSetCookie();
  }
  const value = headers.get('set-cookie');
  return value ? [value] : [];
}
