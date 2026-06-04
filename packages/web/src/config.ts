import {
  createWebRuntime,
  defineRuntime,
  cacheFirst as runtimeCacheFirst,
  cacheOnly as runtimeCacheOnly,
  domain as runtimeDomain,
  middleware as runtimeMiddleware,
  mount as runtimeMount,
  networkFirst as runtimeNetworkFirst,
  networkOnly as runtimeNetworkOnly,
  redirect as runtimeRedirect,
  staleWhileRevalidate as runtimeStaleWhileRevalidate,
  toApp as runtimeToApp,
  toFiles as runtimeToFiles,
  toOrigin as runtimeToOrigin,
  tryApp as runtimeTryApp,
  type FetchApp,
  type WebRuntime,
  type WebRuntimeDefinition,
  type WebRuntimeMiddleware,
  type WebRuntimeRegisteredAppConfig,
  createAsyncDbApp,
  type AsyncDbRuntimeAdapterOptions
} from '@async/webruntime';
import {
  mount,
  normalizeRoutes,
  toApp,
  type AsyncAppRoute,
  type AsyncCacheRoute,
  type AsyncFilesRoute,
  type AsyncHostRoute,
  type AsyncMethodRoute,
  type AsyncMountRoute,
  type AsyncOriginRoute,
  type AsyncRedirectRoute,
  type AsyncRouteInput,
  type AsyncRouteStep,
  type AsyncSplitTrafficRoute,
  type AsyncTryAppRoute
} from '@async/router';

export { createAsyncDbApp };
export type { AsyncDbRuntimeAdapterOptions };

export interface AsyncWebResourceReference {
  resource: string;
}

export interface AsyncWebDirectoryReference {
  dir: string;
}

export interface AsyncWebAuthConfig {
  enabled?: boolean;
  users?: string;
  sessions?: string;
  roles?: string;
  permissions?: string;
}

export interface AsyncWebDeployConfig {
  target?: 'async-cloud' | 'cloudflare' | 'fly' | 'node' | 'static' | string;
  mode?: 'auto' | 'manual' | string;
}

export interface AsyncWebDevConfig {
  port?: number;
  strictPort?: boolean;
}

export type AsyncWebPlacement = 'global' | 'regional' | 'local' | string;
export type AsyncWebRegion = string;
export type AsyncWebBrowserFallback = 'spa' | '404';
export type AsyncWebEnvironmentName = 'local' | 'staging' | 'production' | (string & {});

export interface AsyncWebBuildEnvReference {
  readonly type: 'build-env';
  readonly name: string;
}

export interface AsyncWebEnvValue<TValue> {
  readonly type: 'env-value';
  readonly values: Partial<Record<AsyncWebEnvironmentName, TValue | AsyncWebBuildEnvReference>>;
}

export type AsyncWebConfigValue<TValue> = TValue | AsyncWebBuildEnvReference | AsyncWebEnvValue<TValue>;

export interface AsyncWebResolveValueOptions<TValue = string> {
  environment?: AsyncWebEnvironmentName;
  buildEnv?: Record<string, TValue> | ((name: string) => TValue | undefined);
}

export type AsyncWebConnectionTarget = AsyncWebConfigValue<string>;

export interface AsyncWebConnectionsConfig {
  data?: Record<string, AsyncWebConnectionTarget>;
  auth?: {
    provider?: AsyncWebConnectionTarget;
    [key: string]: AsyncWebConnectionTarget | undefined;
  };
  api?: Record<string, AsyncWebConnectionTarget>;
  events?: Record<string, AsyncWebConnectionTarget | AsyncWebConnectionTarget[]>;
}

export interface AsyncWebDefaultRuntimeAppConfig {
  runtime: string;
  basePath: string;
}

export interface AsyncWebDefaultBrowserAppConfig extends AsyncWebDefaultRuntimeAppConfig {
  document: string;
  fallback: AsyncWebBrowserFallback;
}

export interface AsyncWebDefaultNamedAppConfig {
  runtime: string;
  basePathPattern: string;
}

export interface AsyncWebDefaultRouteMount {
  app: string;
  path: string;
}

export interface AsyncWebDefaultConfig {
  name: string;
  originHostSuffix: string;
  apps: {
    web: AsyncWebDefaultBrowserAppConfig;
    api: AsyncWebDefaultRuntimeAppConfig;
    db: AsyncWebDefaultRuntimeAppConfig;
    other: AsyncWebDefaultNamedAppConfig;
  };
  routes: {
    fallbackApp: string;
    mounts: readonly AsyncWebDefaultRouteMount[];
  };
  asyncDb: {
    runtime: 'async-db';
    basePath: string;
    viewerPath: string;
  };
  dev: {
    port: number;
    strictPort: boolean;
  };
}

export const asyncWebDefaultConfig = {
  name: 'app',
  originHostSuffix: 'async.local',
  apps: {
    web: {
      runtime: 'browser',
      basePath: '/',
      document: './index.html',
      fallback: 'spa'
    },
    api: {
      runtime: 'origin',
      basePath: '/api/'
    },
    db: {
      runtime: 'async-db',
      basePath: '/db/'
    },
    other: {
      runtime: 'origin',
      basePathPattern: '/{name}/'
    }
  },
  routes: {
    fallbackApp: 'web',
    mounts: [
      {
        app: 'db',
        path: '/db'
      },
      {
        app: 'api',
        path: '/api'
      }
    ]
  },
  asyncDb: {
    runtime: 'async-db',
    basePath: '/db/',
    viewerPath: '/__db/'
  },
  dev: {
    port: 4100,
    strictPort: false
  }
} as const satisfies AsyncWebDefaultConfig;

export type AsyncWebComposableApp = FetchApp | AsyncWebAppDefinition | WebRuntimeDefinition;

export interface AsyncWebRuntimeAppConfig extends Omit<WebRuntimeRegisteredAppConfig, 'app'> {
  app?: AsyncWebComposableApp;
  fetch?: FetchApp['fetch'];
  dev?: AsyncWebDevConfig;
  placement?: AsyncWebPlacement;
  region?: AsyncWebRegion;
}

export interface AsyncWebBuilderRuntimeFields {
  runtime?: string;
  platform?: string;
  basePath?: string;
  baseUrl?: string;
  files?: Record<string, string>;
  dev?: AsyncWebDevConfig;
  placement?: AsyncWebPlacement;
  region?: AsyncWebRegion;
}

export interface AsyncWebBrowserAppDescriptor extends AsyncWebBuilderRuntimeFields {
  type: 'browser-app';
  document: string;
  fallback?: AsyncWebBrowserFallback;
  assets?: Record<string, string>;
}

export interface AsyncWebFetchAppDescriptor extends AsyncWebBuilderRuntimeFields {
  type: 'fetch-app';
  fetch: FetchApp['fetch'];
}

export interface AsyncWebAsyncDbAppDescriptor extends AsyncWebBuilderRuntimeFields {
  type: 'async-db-app';
  config: unknown;
  viewerPath?: string;
  operations?: AsyncDbRuntimeAdapterOptions['operations'];
  contracts?: AsyncDbRuntimeAdapterOptions['contracts'];
}

export interface AsyncWebRemoteAppDescriptor extends Omit<AsyncWebBuilderRuntimeFields, 'baseUrl'> {
  type: 'remote-app';
  endpoint: AsyncWebConfigValue<string>;
  manifest: string;
}

export type AsyncWebAppDescriptor =
  | AsyncWebBrowserAppDescriptor
  | AsyncWebFetchAppDescriptor
  | AsyncWebAsyncDbAppDescriptor
  | AsyncWebRemoteAppDescriptor;

export type AsyncWebAppEntry = AsyncWebRuntimeAppConfig | AsyncWebComposableApp | AsyncWebAppDescriptor;

export type AsyncWebBrowserAppOptions = Omit<AsyncWebBrowserAppDescriptor, 'type'>;
export type AsyncWebFetchAppOptions = Omit<AsyncWebFetchAppDescriptor, 'type'>;
export type AsyncWebAsyncDbAppOptions = Omit<AsyncWebAsyncDbAppDescriptor, 'type'>;
export type AsyncWebRemoteAppOptions = Omit<AsyncWebRemoteAppDescriptor, 'type'>;

export interface AsyncWebAppConfig {
  name?: string;
  origin?: string;
  apps?: Record<string, AsyncWebAppEntry>;
  connections?: AsyncWebConnectionsConfig;
  routes?: AsyncWebDirectoryReference | AsyncRouteInput;
  api?: AsyncWebDirectoryReference | AsyncWebRuntimeAppConfig | AsyncWebFetchAppDescriptor;
  db?: unknown;
  dev?: AsyncWebDevConfig;
  auth?: AsyncWebAuthConfig;
  flags?: AsyncWebResourceReference;
  settings?: AsyncWebResourceReference;
  deploy?: AsyncWebDeployConfig;
  runtime?: Partial<Omit<WebRuntimeDefinition, 'origin' | 'apps' | 'routes'>>;
}

export interface AsyncWebAppDefinition extends FetchApp {
  readonly type: 'async-web-app';
  readonly name: string;
  readonly defaults: AsyncWebDefaultConfig;
  readonly config: AsyncWebAppConfig;
  readonly dev: Required<AsyncWebDevConfig>;
  readonly connections: AsyncWebConnectionsConfig;
  readonly routes: readonly AsyncRouteStep[];
  readonly runtime: WebRuntimeDefinition;
  toRuntime(): WebRuntimeDefinition;
}

export interface AsyncWebResolvedDevPort {
  app: string;
  preferredPort: number;
  port: number;
  strictPort: boolean;
}

export function browserApp(options: AsyncWebBrowserAppOptions): AsyncWebBrowserAppDescriptor {
  return {
    type: 'browser-app',
    ...options
  };
}

export function fetchApp(options: AsyncWebFetchAppOptions): AsyncWebFetchAppDescriptor {
  return {
    type: 'fetch-app',
    ...options
  };
}

export function asyncDbApp(options: AsyncWebAsyncDbAppOptions): AsyncWebAsyncDbAppDescriptor {
  return {
    type: 'async-db-app',
    ...options
  };
}

export function remoteApp(options: AsyncWebRemoteAppOptions): AsyncWebRemoteAppDescriptor {
  validateRemoteEndpoint(options.endpoint);
  validateManifestPath(options.manifest);
  return {
    type: 'remote-app',
    ...options
  };
}

export function buildEnv(name: string): AsyncWebBuildEnvReference {
  const normalized = name.trim();
  if (!normalized) {
    throw new Error('buildEnv() requires a non-empty environment variable name.');
  }
  return {
    type: 'build-env',
    name: normalized
  };
}

export function envValue<TValue>(
  values: Partial<Record<AsyncWebEnvironmentName, TValue | AsyncWebBuildEnvReference>>
): AsyncWebEnvValue<TValue> {
  if (!isRecord(values) || Object.keys(values).length === 0) {
    throw new Error('envValue() requires at least one environment value.');
  }
  return {
    type: 'env-value',
    values: { ...values }
  };
}

export function resolveEnvValue<TValue = string>(
  value: AsyncWebConfigValue<TValue>,
  options: AsyncWebResolveValueOptions<TValue> = {}
): TValue {
  const environment = options.environment ?? 'local';
  const selected = isAsyncWebEnvValue(value)
    ? value.values[environment] ?? value.values.local
    : value;
  if (selected === undefined) {
    throw new Error(`No envValue() entry is configured for environment "${environment}".`);
  }
  if (isBuildEnvReference(selected)) {
    const resolved = typeof options.buildEnv === 'function'
      ? options.buildEnv(selected.name)
      : options.buildEnv?.[selected.name];
    if (resolved === undefined) {
      throw new Error(`buildEnv(${JSON.stringify(selected.name)}) was not provided.`);
    }
    return resolved;
  }
  return selected;
}

export function createStaticBrowserApp(options: AsyncWebBrowserAppOptions): FetchApp {
  const fallback = options.fallback ?? 'spa';
  const documentPath = normalizeStaticPath(options.document);
  const basePath = options.basePath ?? '/';

  return {
    async fetch(request, _env, context) {
      const method = request.method.toUpperCase();
      if (method !== 'GET' && method !== 'HEAD') {
        return new Response(null, {
          status: 405,
          headers: {
            allow: 'GET, HEAD'
          }
        });
      }

      const url = new URL(request.url);
      const pathname = stripBrowserBasePath(url.pathname, basePath);
      const requestedPath = pathname === '/' ? documentPath : normalizeStaticPath(pathname);
      const assetPath = await resolveBrowserAssetPath(requestedPath, documentPath, context.fs);
      const isHead = method === 'HEAD';

      if (assetPath) {
        return new Response(isHead ? null : await context.fs.readFile(assetPath), {
          headers: {
            'content-type': contentTypeForStaticPath(assetPath)
          }
        });
      }

      if (fallback === 'spa' && isBrowserNavigationPath(pathname)) {
        const document = await readBrowserDocument(documentPath, context.fs, options.document);
        return new Response(isHead ? null : document, {
          headers: {
            'content-type': 'text/html; charset=utf-8'
          }
        });
      }

      return new Response('Not found', {
        status: 404,
        headers: {
          'content-type': 'text/plain; charset=utf-8'
        }
      });
    }
  };
}

export function defineApp(config: AsyncWebAppConfig): AsyncWebAppDefinition {
  const defaults = asyncWebDefaultConfig;
  validateConnections(config.connections);
  const name = resolveAppName(config, defaults);
  const origin = resolveOrigin(config, name, defaults);
  const apps = createRuntimeApps(config, defaults);
  const routes = isDirectoryReference(config.routes)
    ? createDefaultRoutes(apps, defaults)
    : normalizeRoutes(config.routes ?? createDefaultRoutes(apps, defaults));
  const runtime = defineRuntime({
    origin,
    apps,
    routes: createRuntimeRoutes(routes),
    platforms: config.runtime?.platforms,
    runtimes: config.runtime?.runtimes,
    files: config.runtime?.files,
    env: config.runtime?.env,
    platform: config.runtime?.platform,
    delay: config.runtime?.delay,
    proxyHooks: config.runtime?.proxyHooks,
    ui: config.runtime?.ui
  });
  let webRuntime: Promise<WebRuntime> | undefined;

  return {
    type: 'async-web-app',
    name,
    defaults,
    config,
    dev: resolveDevConfig(config.dev, defaults),
    connections: config.connections ?? {},
    routes,
    runtime,
    async fetch(request) {
      webRuntime ??= createWebRuntime(runtime);
      return (await webRuntime).fetch(request);
    },
    toRuntime() {
      return runtime;
    }
  };
}

export function toWebRuntimeConfig(
  app: AsyncWebAppDefinition | AsyncWebAppConfig | WebRuntimeDefinition
): WebRuntimeDefinition {
  if (isAsyncWebAppDefinition(app)) {
    return app.runtime;
  }
  if (isWebRuntimeDefinition(app)) {
    return app;
  }
  return defineApp(app).runtime;
}

export function resolveDevPorts(
  app: AsyncWebAppDefinition | AsyncWebAppConfig,
  options: {
    occupiedPorts?: Iterable<number>;
  } = {}
): AsyncWebResolvedDevPort[] {
  const definition = isAsyncWebAppDefinition(app) ? app : defineApp(app);
  const occupied = new Set(options.occupiedPorts ?? []);
  const resolved: AsyncWebResolvedDevPort[] = [
    resolveDevPort(definition.name, definition.dev, occupied)
  ];

  for (const [name, entry] of Object.entries(definition.config.apps ?? {})) {
    const childDev = resolveChildDevConfig(entry, definition.defaults);
    if (!childDev) {
      continue;
    }
    resolved.push(resolveDevPort(name, childDev, occupied));
  }

  return resolved;
}

function createRuntimeApps(
  config: AsyncWebAppConfig,
  defaults: AsyncWebDefaultConfig
): Record<string, WebRuntimeRegisteredAppConfig> {
  const apps: Record<string, WebRuntimeRegisteredAppConfig> = {};
  const userApps = config.apps ?? {};
  const explicitApps = Object.entries(userApps);

  if (explicitApps.length === 0) {
    apps[defaults.routes.fallbackApp] = normalizeAppConfig(
      undefined,
      createDefaultAppConfig(defaults.routes.fallbackApp, defaults)
    );
  }

  for (const [name, app] of explicitApps) {
    apps[name] = normalizeAppConfig(app, createDefaultAppConfig(name, defaults));
  }

  const apiConfig = normalizeApiConfig(config.api);
  if (apiConfig && !hasUserDefined(userApps, 'api')) {
    apps.api = normalizeAppConfig(apiConfig, createDefaultAppConfig('api', defaults));
  }

  if (hasUserDefined(config, 'db') && config.db !== undefined && !hasUserDefined(userApps, 'db')) {
    const dbDefaults = defaults.apps.db;
    apps.db = normalizeAppConfig(undefined, {
      app: createAsyncDbApp(createAsyncDbOptions(config.db, defaults)),
      runtime: dbDefaults.runtime,
      basePath: dbDefaults.basePath
    });
  }

  return apps;
}

function createDefaultRoutes(
  apps: Record<string, WebRuntimeRegisteredAppConfig>,
  defaults: AsyncWebDefaultConfig
): AsyncRouteStep[] {
  const routes: AsyncRouteStep[] = [];
  const mountedApps = new Set<string>();
  for (const route of defaults.routes.mounts) {
    if (!apps[route.app]) {
      continue;
    }
    routes.push(mount(route.path, toApp(route.app)));
    mountedApps.add(route.app);
  }
  for (const [name, app] of Object.entries(apps)) {
    if (mountedApps.has(name) || name === defaults.routes.fallbackApp) {
      continue;
    }
    const mountPath = app.basePath ? basePathToMountPath(app.basePath) : undefined;
    if (!mountPath) {
      continue;
    }
    routes.push(mount(mountPath, toApp(name)));
    mountedApps.add(name);
  }
  if (apps[defaults.routes.fallbackApp]) {
    routes.push(toApp(defaults.routes.fallbackApp));
  } else if (routes.length === 0) {
    const [firstAppName] = Object.keys(apps);
    if (firstAppName) {
      routes.push(toApp(firstAppName));
    }
  }
  return routes;
}

function createRuntimeRoutes(routes: readonly AsyncRouteStep[]): WebRuntimeMiddleware[] {
  return routes.flatMap((route) => createRuntimeRoute(route));
}

function createRuntimeRoute(route: AsyncRouteStep): WebRuntimeMiddleware[] {
  switch (route.type) {
    case 'app':
      return [
        compileAppRoute(route)
      ];
    case 'mount':
      return [
        compileMountRoute(route)
      ];
    case 'host':
      return [
        compileHostRoute(route)
      ];
    case 'method':
      return [
        compileMethodRoute(route)
      ];
    case 'origin':
      return [
        compileOriginRoute(route)
      ];
    case 'files':
      return [
        compileFilesRoute(route)
      ];
    case 'redirect':
      return [
        compileRedirectRoute(route)
      ];
    case 'cache':
      return compileCacheRoute(route);
    case 'split-traffic':
      return [
        compileSplitTrafficRoute(route)
      ];
    case 'try-app':
      return [
        compileTryAppRoute(route)
      ];
  }
}

function compileAppRoute(route: AsyncAppRoute): WebRuntimeMiddleware {
  return runtimeToApp(route.app);
}

function compileMountRoute(route: AsyncMountRoute): WebRuntimeMiddleware {
  return runtimeMount(route.path, createRuntimeRoutes(route.to));
}

function compileHostRoute(route: AsyncHostRoute): WebRuntimeMiddleware {
  return runtimeDomain(route.hostname, createRuntimeRoutes(route.to));
}

function compileMethodRoute(route: AsyncMethodRoute): WebRuntimeMiddleware {
  return runtimeMiddleware((request, url) => {
    return request.method.toUpperCase() === route.method.toUpperCase()
      && (!route.path || url.pathname === route.path);
  }, createRuntimeRoutes(route.to));
}

function compileOriginRoute(route: AsyncOriginRoute): WebRuntimeMiddleware {
  return runtimeToOrigin(route.origin);
}

function compileFilesRoute(route: AsyncFilesRoute): WebRuntimeMiddleware {
  const { type: _type, ...options } = route;
  return runtimeToFiles(options);
}

function compileRedirectRoute(route: AsyncRedirectRoute): WebRuntimeMiddleware {
  return runtimeRedirect(route.url, route.status);
}

function compileCacheRoute(route: AsyncCacheRoute): WebRuntimeMiddleware[] {
  const { type: _type, strategy: _strategy, next, key, ...options } = route;
  const runtimeOptions = {
    ...options,
    key
  };
  const middleware = route.strategy === 'cache-first'
    ? runtimeCacheFirst(runtimeOptions)
    : route.strategy === 'network-first'
      ? runtimeNetworkFirst(runtimeOptions)
      : route.strategy === 'stale-while-revalidate'
        ? runtimeStaleWhileRevalidate(runtimeOptions)
        : route.strategy === 'cache-only'
          ? runtimeCacheOnly(runtimeOptions)
          : runtimeNetworkOnly();
  return [
    middleware,
    ...createRuntimeRoutes(next ?? [])
  ];
}

function compileSplitTrafficRoute(route: AsyncSplitTrafficRoute): WebRuntimeMiddleware {
  return (_request, _context, next) => {
    const firstRunnable = route.variants.find((variant) => variant.weight > 0) ?? route.variants[0];
    if (!firstRunnable) {
      return next();
    }
    const runtimeRoutes = createRuntimeRoutes(firstRunnable.to);
    return runtimeMiddleware(() => true, runtimeRoutes)(_request, _context, next);
  };
}

function compileTryAppRoute(route: AsyncTryAppRoute): WebRuntimeMiddleware {
  return runtimeTryApp({
    fallthroughStatus: route.fallthroughStatus
  }, route.candidates.map((candidate) => createRuntimeRoute(candidate)));
}

function normalizeApiConfig(
  api: AsyncWebAppConfig['api']
): AsyncWebRuntimeAppConfig | AsyncWebFetchAppDescriptor | undefined {
  if (!api) {
    return undefined;
  }
  if ('dir' in api) {
    return undefined;
  }
  return api;
}

function isDirectoryReference(value: unknown): value is AsyncWebDirectoryReference {
  return isRecord(value) && typeof value.dir === 'string';
}

function normalizeAppConfig(
  config: AsyncWebAppEntry | undefined,
  defaults: WebRuntimeRegisteredAppConfig
): WebRuntimeRegisteredAppConfig {
  if (isAsyncWebAppDescriptor(config)) {
    return normalizeAppDescriptor(config, defaults);
  }

  if (isAsyncWebAppDefinition(config) || isWebRuntimeDefinition(config)) {
    return {
      ...defaults,
      app: createFetchAppFromComposable(config)
    };
  }

  const { configuredApp, fetch, rest } = normalizeStructuredAppEntry(config);
  const app = configuredApp
    ? createFetchAppFromComposable(configuredApp)
    : fetch
      ? { fetch }
      : defaults.app;
  return {
    ...defaults,
    ...rest,
    app
  };
}

function normalizeAppDescriptor(
  descriptor: AsyncWebAppDescriptor,
  defaults: WebRuntimeRegisteredAppConfig
): WebRuntimeRegisteredAppConfig {
  const runtimeFields = stripBuilderRuntimeFields(descriptor);
  if (descriptor.type === 'browser-app') {
    const basePath = descriptor.basePath ?? defaults.basePath;
    return {
      ...defaults,
      ...runtimeFields,
      runtime: descriptor.runtime ?? 'browser',
      basePath,
      app: createStaticBrowserApp({
        ...descriptor,
        basePath
      }),
      files: {
        ...defaults.files,
        ...normalizeStaticBrowserFiles(descriptor)
      }
    };
  }
  if (descriptor.type === 'fetch-app') {
    return {
      ...defaults,
      ...runtimeFields,
      app: {
        fetch: descriptor.fetch
      }
    };
  }

  if (descriptor.type === 'remote-app') {
    return normalizeRemoteAppDescriptor(descriptor, defaults);
  }

  const options = createAsyncDbDescriptorOptions(descriptor, asyncWebDefaultConfig);
  return {
    ...defaults,
    ...runtimeFields,
    runtime: descriptor.runtime ?? 'async-db',
    basePath: descriptor.basePath ?? options.basePath,
    app: createAsyncDbApp(options)
  };
}

function normalizeRemoteAppDescriptor(
  descriptor: AsyncWebRemoteAppDescriptor,
  defaults: WebRuntimeRegisteredAppConfig
): WebRuntimeRegisteredAppConfig {
  const endpoint = firstLiteralEnvString(descriptor.endpoint);
  const runtimeFields = stripBuilderRuntimeFields(descriptor);
  const baseUrl = endpoint ? normalizeUrl(endpoint) : undefined;
  const {
    basePath: _defaultBasePath,
    ...remoteDefaults
  } = defaults;
  const runtimeConfig: WebRuntimeRegisteredAppConfig = {
    ...remoteDefaults,
    ...runtimeFields,
    runtime: descriptor.runtime ?? 'remote',
    app: createRemoteAppPlaceholder(descriptor)
  };
  if (baseUrl) {
    runtimeConfig.baseUrl = baseUrl;
  } else if (runtimeFields.basePath) {
    runtimeConfig.basePath = runtimeFields.basePath;
  }
  return runtimeConfig;
}

function stripBuilderRuntimeFields(
  descriptor: AsyncWebAppDescriptor & Partial<AsyncWebBuilderRuntimeFields>
): Partial<Omit<AsyncWebBuilderRuntimeFields, 'dev' | 'placement' | 'region'>> {
  const fields: Partial<Omit<AsyncWebBuilderRuntimeFields, 'dev' | 'placement' | 'region'>> = {};
  if (descriptor.runtime !== undefined) {
    fields.runtime = descriptor.runtime;
  }
  if (descriptor.platform !== undefined) {
    fields.platform = descriptor.platform;
  }
  if (descriptor.basePath !== undefined) {
    fields.basePath = descriptor.basePath;
  }
  if (descriptor.baseUrl !== undefined) {
    fields.baseUrl = descriptor.baseUrl;
  }
  if (descriptor.files !== undefined) {
    fields.files = descriptor.files;
  }
  return fields;
}

function normalizeStructuredAppEntry(
  config: FetchApp | AsyncWebRuntimeAppConfig | undefined
): {
  configuredApp?: AsyncWebComposableApp;
  fetch?: FetchApp['fetch'];
  rest: Omit<AsyncWebRuntimeAppConfig, 'app' | 'fetch'>;
} {
  if (!config) {
    return {
      rest: {}
    };
  }
  if (!isRuntimeAppConfig(config)) {
    return {
      fetch: config.fetch,
      rest: {}
    };
  }
  const {
    app,
    fetch,
    dev: _dev,
    placement: _placement,
    region: _region,
    ...rest
  } = config;
  return {
    configuredApp: app,
    fetch,
    rest
  };
}

function isRuntimeAppConfig(
  value: unknown
): value is AsyncWebRuntimeAppConfig {
  return isRecord(value)
    && (
      'app' in value
      || 'runtime' in value
      || 'platform' in value
      || 'basePath' in value
      || 'baseUrl' in value
      || 'files' in value
      || 'dev' in value
      || 'placement' in value
      || 'region' in value
    );
}

function createDefaultAppConfig(
  name: string,
  defaults: AsyncWebDefaultConfig
): WebRuntimeRegisteredAppConfig {
  const appDefaults = resolveDefaultAppConfig(name, defaults);
  const app = name === defaults.routes.fallbackApp
    ? createStaticBrowserApp({
      document: defaults.apps.web.document,
      fallback: defaults.apps.web.fallback,
      basePath: defaults.apps.web.basePath
    })
    : placeholderApp(name);
  return {
    app,
    runtime: appDefaults.runtime,
    basePath: appDefaults.basePath
  };
}

function resolveDefaultAppConfig(
  name: string,
  defaults: AsyncWebDefaultConfig
): AsyncWebDefaultRuntimeAppConfig {
  if (name === 'web') {
    return defaults.apps.web;
  }
  if (name === 'api') {
    return defaults.apps.api;
  }
  if (name === 'db') {
    return defaults.apps.db;
  }
  return {
    runtime: defaults.apps.other.runtime,
    basePath: defaults.apps.other.basePathPattern.replace('{name}', name)
  };
}

function createFetchAppFromComposable(app: AsyncWebComposableApp): FetchApp {
  if (isAsyncWebAppDefinition(app)) {
    return createWebRuntimeFetchApp(app.runtime);
  }
  if (isWebRuntimeDefinition(app)) {
    return createWebRuntimeFetchApp(app);
  }
  return app;
}

function createWebRuntimeFetchApp(runtime: WebRuntimeDefinition): FetchApp {
  let webRuntime: Promise<WebRuntime> | undefined;
  return {
    async fetch(request) {
      webRuntime ??= createWebRuntime(runtime);
      return (await webRuntime).fetch(request);
    }
  };
}

function createAsyncDbOptions(
  db: unknown,
  defaults: AsyncWebDefaultConfig
): AsyncDbRuntimeAdapterOptions {
  if (isAsyncDbOptions(db)) {
    return db;
  }
  return {
    config: db,
    runtime: defaults.asyncDb.runtime,
    basePath: defaults.asyncDb.basePath,
    viewerPath: defaults.asyncDb.viewerPath
  };
}

function createAsyncDbDescriptorOptions(
  descriptor: AsyncWebAsyncDbAppDescriptor,
  defaults: AsyncWebDefaultConfig
): AsyncDbRuntimeAdapterOptions {
  return {
    config: descriptor.config,
    runtime: descriptor.runtime ?? defaults.asyncDb.runtime,
    basePath: descriptor.basePath ?? defaults.asyncDb.basePath,
    viewerPath: descriptor.viewerPath ?? defaults.asyncDb.viewerPath,
    operations: descriptor.operations,
    contracts: descriptor.contracts
  };
}

function normalizeStaticBrowserFiles(
  descriptor: AsyncWebBrowserAppDescriptor
): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [path, value] of Object.entries(descriptor.files ?? {})) {
    files[normalizeStaticPath(path)] = value;
  }
  for (const [path, value] of Object.entries(descriptor.assets ?? {})) {
    files[normalizeStaticPath(path)] = value;
  }
  return files;
}

async function resolveBrowserAssetPath(
  requestedPath: string,
  documentPath: string,
  fs: WebRuntime['fs']
): Promise<string | undefined> {
  const candidates = requestedPath === documentPath
    ? [documentPath]
    : [
      requestedPath,
      `/public${requestedPath}`,
      `/static${requestedPath}`,
      joinStaticPath(dirnameStaticPath(documentPath), requestedPath)
    ];

  for (const candidate of candidates) {
    if (await fs.exists(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

async function readBrowserDocument(
  documentPath: string,
  fs: WebRuntime['fs'],
  documentSource: string
): Promise<string> {
  if (await fs.exists(documentPath)) {
    return fs.readFile(documentPath);
  }
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Async Web</title>',
    '</head>',
    '<body>',
    `<div id="root" data-async-web-document="${escapeHtml(documentSource)}"></div>`,
    '</body>',
    '</html>'
  ].join('');
}

function normalizeStaticPath(path: string): string {
  const withoutQuery = path.split(/[?#]/, 1)[0] ?? '';
  const withForwardSlashes = withoutQuery.replaceAll('\\', '/');
  const normalized: string[] = [];
  for (const part of withForwardSlashes.split('/')) {
    if (!part || part === '.') {
      continue;
    }
    if (part === '..') {
      throw new Error(`Invalid Async Web static asset path: ${path}`);
    }
    normalized.push(part);
  }
  return `/${normalized.join('/')}`;
}

function stripBrowserBasePath(pathname: string, basePath: string): string {
  const normalizedPathname = normalizeStaticPath(pathname);
  const normalizedBasePath = normalizeStaticPath(basePath);
  if (normalizedBasePath === '/') {
    return normalizedPathname;
  }
  if (normalizedPathname === normalizedBasePath) {
    return '/';
  }
  if (normalizedPathname.startsWith(`${normalizedBasePath}/`)) {
    return normalizeStaticPath(normalizedPathname.slice(normalizedBasePath.length));
  }
  return normalizedPathname;
}

function isBrowserNavigationPath(pathname: string): boolean {
  const normalized = normalizeStaticPath(pathname);
  if (normalized.endsWith('/')) {
    return true;
  }
  const lastSegment = normalized.split('/').pop() ?? '';
  return !lastSegment.includes('.');
}

function dirnameStaticPath(path: string): string {
  const normalized = normalizeStaticPath(path);
  const parts = normalized.split('/').filter(Boolean);
  parts.pop();
  return `/${parts.join('/')}`;
}

function joinStaticPath(base: string, path: string): string {
  return normalizeStaticPath(`${base}/${path}`);
}

function contentTypeForStaticPath(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase();
  switch (extension) {
    case 'html':
      return 'text/html; charset=utf-8';
    case 'css':
      return 'text/css; charset=utf-8';
    case 'js':
    case 'mjs':
      return 'text/javascript; charset=utf-8';
    case 'json':
      return 'application/json; charset=utf-8';
    case 'svg':
      return 'image/svg+xml';
    case 'png':
      return 'image/png';
    case 'ico':
      return 'image/x-icon';
    default:
      return 'application/octet-stream';
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function resolveDevConfig(
  dev: AsyncWebDevConfig | undefined,
  defaults: AsyncWebDefaultConfig
): Required<AsyncWebDevConfig> {
  return {
    port: dev?.port ?? defaults.dev.port,
    strictPort: dev?.strictPort ?? defaults.dev.strictPort
  };
}

function resolveChildDevConfig(
  entry: AsyncWebAppEntry,
  defaults: AsyncWebDefaultConfig
): Required<AsyncWebDevConfig> | undefined {
  if (isAsyncWebAppDefinition(entry)) {
    return entry.dev;
  }
  if (isAsyncWebAppDescriptor(entry) && entry.dev) {
    return resolveDevConfig(entry.dev, defaults);
  }
  if (!isWebRuntimeDefinition(entry) && isRuntimeAppConfig(entry) && entry.dev) {
    return resolveDevConfig(entry.dev, defaults);
  }
  return undefined;
}

function resolveDevPort(
  app: string,
  dev: Required<AsyncWebDevConfig>,
  occupied: Set<number>
): AsyncWebResolvedDevPort {
  let port = dev.port;
  if (!dev.strictPort) {
    while (occupied.has(port)) {
      port += 1;
    }
  }
  occupied.add(port);
  return {
    app,
    preferredPort: dev.port,
    port,
    strictPort: dev.strictPort
  };
}

function isAsyncDbOptions(value: unknown): value is AsyncDbRuntimeAdapterOptions {
  return value !== null
    && typeof value === 'object'
    && 'config' in value;
}

function placeholderApp(name: string): FetchApp {
  return {
    fetch(request) {
      return Response.json({
        ok: true,
        app: name,
        pathname: new URL(request.url).pathname,
        message: `@async/web placeholder app "${name}" is mounted. Provide a fetch app or source directory to handle requests.`
      });
    }
  };
}

function isAsyncWebAppDefinition(value: unknown): value is AsyncWebAppDefinition {
  return value !== null
    && typeof value === 'object'
    && (value as { type?: unknown }).type === 'async-web-app'
    && 'runtime' in value;
}

function isAsyncWebAppDescriptor(value: unknown): value is AsyncWebAppDescriptor {
  if (!isRecord(value)) {
    return false;
  }
  return value.type === 'browser-app'
    || value.type === 'fetch-app'
    || value.type === 'async-db-app'
    || value.type === 'remote-app';
}

function isWebRuntimeDefinition(value: unknown): value is WebRuntimeDefinition {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as {
    origin?: unknown;
    apps?: unknown;
    routes?: unknown;
  };
  return typeof candidate.origin === 'string'
    && isRecord(candidate.apps)
    && Array.isArray(candidate.routes)
    && Object.values(candidate.apps).every((app) => {
      return isRecord(app) && isFetchApp(app.app);
    });
}

function isFetchApp(value: unknown): value is FetchApp {
  return value !== null
    && typeof value === 'object'
    && typeof (value as { fetch?: unknown }).fetch === 'function';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function createRemoteAppPlaceholder(descriptor: AsyncWebRemoteAppDescriptor): FetchApp {
  return {
    fetch(request) {
      return Response.json({
        ok: true,
        runtime: descriptor.runtime ?? 'remote',
        endpoint: descriptor.endpoint,
        manifest: descriptor.manifest,
        pathname: new URL(request.url).pathname,
        message: '@async/web remote app descriptor is mounted. Remote execution and manifest loading are handled by build/dev orchestration.'
      });
    }
  };
}

function isBuildEnvReference(value: unknown): value is AsyncWebBuildEnvReference {
  return isRecord(value)
    && value.type === 'build-env'
    && typeof value.name === 'string';
}

function isAsyncWebEnvValue<TValue = unknown>(value: unknown): value is AsyncWebEnvValue<TValue> {
  return isRecord(value)
    && value.type === 'env-value'
    && isRecord(value.values);
}

function validateRemoteEndpoint(value: AsyncWebConfigValue<string>): void {
  forEachLiteralConfigValue(value, (literal) => {
    normalizeUrl(literal);
  });
}

function validateManifestPath(manifest: string): void {
  if (typeof manifest !== 'string' || manifest.trim() === '') {
    throw new Error('remoteApp() manifest must be a non-empty path or URL.');
  }
  if (/^https?:\/\//.test(manifest)) {
    normalizeUrl(manifest);
    return;
  }
  if (!manifest.startsWith('/')) {
    throw new Error('remoteApp() manifest must be an absolute path or URL.');
  }
}

function validateConnections(connections: AsyncWebConnectionsConfig | undefined): void {
  if (!connections) {
    return;
  }
  for (const [key, target] of Object.entries(connections.data ?? {})) {
    validateContractReferenceTarget(target, `connections.data.${key}`);
  }
  for (const [key, target] of Object.entries(connections.api ?? {})) {
    validateContractReferenceTarget(target, `connections.api.${key}`);
  }
  for (const [key, target] of Object.entries(connections.events ?? {})) {
    const targets = Array.isArray(target) ? target : [target];
    for (const eventTarget of targets) {
      validateContractReferenceTarget(eventTarget, `connections.events.${key}`);
    }
  }
  for (const [key, target] of Object.entries(connections.auth ?? {})) {
    if (target !== undefined) {
      validateReferenceStringTarget(target, `connections.auth.${key}`);
    }
  }
}

function validateContractReferenceTarget(target: AsyncWebConnectionTarget, path: string): void {
  validateReferenceStringTarget(target, path, (literal) => {
    if (!literal.includes('.contracts.')) {
      throw new Error(`${path} must point at an app contract reference.`);
    }
  });
}

function validateReferenceStringTarget(
  target: AsyncWebConnectionTarget,
  path: string,
  validate?: (literal: string) => void
): void {
  forEachLiteralConfigValue(target, (literal) => {
    if (!/^[A-Za-z0-9_.:-]+$/.test(literal)) {
      throw new Error(`${path} must be a dotted reference without whitespace.`);
    }
    validate?.(literal);
  });
}

function forEachLiteralConfigValue<TValue>(
  value: AsyncWebConfigValue<TValue>,
  visit: (literal: TValue) => void
): void {
  if (isBuildEnvReference(value)) {
    return;
  }
  if (isAsyncWebEnvValue<TValue>(value)) {
    for (const entry of Object.values(value.values)) {
      if (entry !== undefined && !isBuildEnvReference(entry)) {
        visit(entry);
      }
    }
    return;
  }
  visit(value);
}

function firstLiteralEnvString(value: AsyncWebConfigValue<string>): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (!isAsyncWebEnvValue<string>(value)) {
    return null;
  }
  const preferred = value.values.local;
  if (typeof preferred === 'string') {
    return preferred;
  }
  for (const entry of Object.values(value.values)) {
    if (typeof entry === 'string') {
      return entry;
    }
  }
  return null;
}

function normalizeUrl(value: string): string {
  try {
    return new URL(value).href;
  } catch {
    throw new Error(`Expected URL value, received ${JSON.stringify(value)}.`);
  }
}

function hasUserDefined(container: object | undefined, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(container ?? {}, key);
}

function resolveAppName(
  config: AsyncWebAppConfig,
  defaults: AsyncWebDefaultConfig
): string {
  if (config.name) {
    return config.name;
  }
  if (config.origin) {
    return new URL(config.origin).hostname.split('.')[0] || 'app';
  }
  return defaults.name;
}

function resolveOrigin(
  config: AsyncWebAppConfig,
  name: string,
  defaults: AsyncWebDefaultConfig
): string {
  return config.origin ?? `https://${name}.${defaults.originHostSuffix}`;
}

function basePathToMountPath(basePath: string): string | undefined {
  if (basePath === '/' || basePath === '') {
    return undefined;
  }
  return basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
}
