import type {
  WebRuntimeCacheQueryOptions,
  WebRuntimeMiddleware,
  WebRuntimeNext,
  WebRuntimeRouteContext,
  WebRuntimeTraceEntry,
  PipelineTraceController
} from './types.ts';
import { contentTypeForPath } from './content-type.ts';

export type WebRuntimeMiddlewareInput = WebRuntimeMiddleware | WebRuntimeMiddleware[];
export type WebRuntimeCacheStore = 'service-worker' | 'edge' | `named:${string}`;
export type WebRuntimeCacheKey =
  | string
  | ((request: Request, url: URL, context: WebRuntimeRouteContext) => string | Promise<string>);

export interface WebRuntimeCacheMiddlewareOptions {
  store?: WebRuntimeCacheStore;
  key?: WebRuntimeCacheKey;
  ttl?: number;
  tags?: string[];
  query?: WebRuntimeCacheQueryOptions;
}

export interface WebRuntimeFilesMiddlewareOptions {
  publicPrefix?: string;
  filePrefix?: string;
  cacheControl?: string;
}

export interface WebRuntimeTryAppOptions {
  fallthroughStatus?: readonly number[];
}

export type WebRuntimeTryAppCandidate = WebRuntimeMiddlewareInput;

export function composeWebRuntime(input: WebRuntimeMiddlewareInput): WebRuntimeMiddleware {
  const middleware = Array.isArray(input) ? input : [input];

  return async function composedWebRuntimeMiddleware(request, context, next) {
    let index = -1;

    async function dispatch(position: number, nextRequest: Request): Promise<Response> {
      if (position <= index) {
        throw new Error('WebRuntime middleware called next() multiple times');
      }
      index = position;
      const handler = middleware[position];
      if (!handler) {
        return next(nextRequest);
      }
      return handler(nextRequest, context, (requestOverride = nextRequest) => {
        return dispatch(position + 1, requestOverride);
      });
    }

    return dispatch(0, request);
  };
}

export function domain(hostname: string, input: WebRuntimeMiddlewareInput): WebRuntimeMiddleware {
  const child = composeWebRuntime(input);
  return (request, context, next) => {
    const url = new URL(request.url);
    const match = matchPattern(hostname, url.hostname);
    if (!match.matched) {
      return next();
    }
    return withRouteState(context, {
      vhost: Object.values(match.params).join('.')
    }, () => child(request, context, next));
  };
}

export function mount(prefix: string, input: WebRuntimeMiddlewareInput): WebRuntimeMiddleware {
  const child = composeWebRuntime(input);
  const normalizedPrefix = normalizePrefix(prefix);

  return (request, context, next) => {
    const url = new URL(request.url);
    if (!matchesMount(url.pathname, normalizedPrefix)) {
      return next();
    }

    const mountedUrl = new URL(request.url);
    const stripped = url.pathname.slice(normalizedPrefix.length);
    mountedUrl.pathname = stripped.startsWith('/') ? stripped : `/${stripped}`;
    if (mountedUrl.pathname === '/') {
      mountedUrl.pathname = '/';
    }
    const mountedRequest = new Request(mountedUrl, request);

    return withRouteState(context, {
      mountPath: normalizedPrefix
    }, () => child(mountedRequest, context, () => next(request)));
  };
}

export function middleware(
  check: (request: Request, url: URL) => boolean | Promise<boolean>,
  input: WebRuntimeMiddlewareInput
): WebRuntimeMiddleware {
  const child = composeWebRuntime(input);
  return async (request, context, next) => {
    const url = new URL(request.url);
    if (!(await check(request, url))) {
      return next();
    }
    return child(request, context, next);
  };
}

export function createVerbMiddleware(method?: string): (
  path: string,
  input: WebRuntimeMiddlewareInput
) => WebRuntimeMiddleware {
  return (path, input) => {
    const child = composeWebRuntime(input);
    return (request, context, next) => {
      if (!matchesMethod(method, request.method)) {
        return next();
      }
      const url = new URL(request.url);
      const match = matchPattern(path, url.pathname);
      if (!match.matched) {
        return next();
      }
      return withRouteState(context, {
        params: match.params
      }, () => child(request, context, next));
    };
  };
}

export const all = createVerbMiddleware();
export const get = createVerbMiddleware('GET');
export const put = createVerbMiddleware('PUT');
export const post = createVerbMiddleware('POST');
export const patch = createVerbMiddleware('PATCH');
export const del = createVerbMiddleware('DELETE');

export function toApp(name: string): WebRuntimeMiddleware {
  return (request, context) => {
    return withRouteState(context, {
      target: name
    }, () => context.fetchApp(name, request));
  };
}

export function tryApp(
  options: WebRuntimeTryAppOptions = {},
  candidates: readonly WebRuntimeTryAppCandidate[] = []
): WebRuntimeMiddleware {
  const fallthroughStatus = new Set(options.fallthroughStatus ?? [404]);
  const fallthroughResponseStatus = options.fallthroughStatus?.[0] ?? 404;
  const composedCandidates = candidates.map((candidate) => composeWebRuntime(candidate));

  return async (request, context, next) => {
    for (const candidate of composedCandidates) {
      const response = await candidate(request, context, () => new Response(null, {
        status: fallthroughResponseStatus
      }));
      if (!fallthroughStatus.has(response.status)) {
        return response;
      }
    }
    return next(request);
  };
}

export function toOrigin(baseUrl: string): WebRuntimeMiddleware {
  return (request) => {
    const sourceUrl = new URL(request.url);
    const targetUrl = new URL(baseUrl);
    targetUrl.pathname = joinPaths(targetUrl.pathname, sourceUrl.pathname);
    targetUrl.search = sourceUrl.search;
    const proxyRequest = new Request(targetUrl, request);
    return fetch(proxyRequest);
  };
}

export function toFiles(options: WebRuntimeFilesMiddlewareOptions = {}): WebRuntimeMiddleware {
  const publicPrefix = normalizePrefix(options.publicPrefix ?? '/');
  const filePrefix = normalizePrefix(options.filePrefix ?? '/');

  return async (request, context, next) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return next();
    }

    const url = new URL(request.url);
    if (!matchesMount(url.pathname, publicPrefix)) {
      return next();
    }

    const stripped = publicPrefix
      ? url.pathname.slice(publicPrefix.length)
      : url.pathname;
    const filePath = joinPaths(filePrefix, stripped || '/index.html');
    if (!(await context.fs.exists(filePath))) {
      return next();
    }

    const headers = new Headers({
      'content-type': contentTypeForPath(filePath)
    });
    if (options.cacheControl) {
      headers.set('cache-control', options.cacheControl);
    }
    return new Response(request.method === 'HEAD' ? null : await context.fs.readFile(filePath), {
      headers
    });
  };
}

export function cacheFirst(options: WebRuntimeCacheMiddlewareOptions = {}): WebRuntimeMiddleware {
  return async (request, context, next) => {
    const cache = await resolveCacheStore(context, options);
    const cacheRequest = await createCacheRequest(request, context, options);
    const cached = await cache.match(cacheRequest, options.query);
    if (cached) {
      context.route.cacheHit = true;
      recordCacheTrace(context, cache.store === 'edge' ? 'edge:cache-hit' : undefined, request, cached, {
        store: cache.store
      });
      return cached;
    }

    context.route.cacheHit = false;
    recordCacheTrace(context, cache.store === 'edge' ? 'edge:cache-miss' : undefined, request, undefined, {
      store: cache.store
    });
    const response = await next();
    await cache.put(cacheRequest, response.clone());
    recordCacheTrace(context, cache.store === 'edge' ? 'edge:cache-put' : undefined, request, response, {
      store: cache.store
    });
    return response;
  };
}

export function staleWhileRevalidate(options: WebRuntimeCacheMiddlewareOptions = {}): WebRuntimeMiddleware {
  return async (request, context, next) => {
    const cache = await resolveCacheStore(context, options);
    const cacheRequest = await createCacheRequest(request, context, options);
    const cached = await cache.match(cacheRequest, options.query);
    if (cached) {
      context.route.cacheHit = true;
      context.waitUntil(Promise.resolve(next()).then((response) => cache.put(cacheRequest, response.clone())));
      return cached;
    }

    context.route.cacheHit = false;
    const response = await next();
    await cache.put(cacheRequest, response.clone());
    return response;
  };
}

export function networkFirst(options: WebRuntimeCacheMiddlewareOptions = {}): WebRuntimeMiddleware {
  return async (request, context, next) => {
    const cache = await resolveCacheStore(context, options);
    const cacheRequest = await createCacheRequest(request, context, options);
    try {
      const response = await next();
      context.route.cacheHit = false;
      await cache.put(cacheRequest, response.clone());
      return response;
    } catch (error) {
      const cached = await cache.match(cacheRequest, options.query);
      if (cached) {
        context.route.cacheHit = true;
        return cached;
      }
      throw error;
    }
  };
}

export function cacheOnly(options: WebRuntimeCacheMiddlewareOptions = {}): WebRuntimeMiddleware {
  return async (request, context) => {
    const cache = await resolveCacheStore(context, options);
    const cacheRequest = await createCacheRequest(request, context, options);
    const cached = await cache.match(cacheRequest, options.query);
    context.route.cacheHit = Boolean(cached);
    return cached ?? new Response('WebRuntime cache miss', {
      status: 504
    });
  };
}

export function networkOnly(): WebRuntimeMiddleware {
  return (_request, _context, next) => next();
}

export function redirect(url: string, status = 302): WebRuntimeMiddleware {
  return () => new Response(null, {
    status,
    headers: {
      location: url,
      'x-redirect-to': url
    }
  });
}

export function json(data: unknown, init: ResponseInit & { pretty?: boolean } = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  return new Response(JSON.stringify(data, null, init.pretty ? 2 : undefined), {
    ...init,
    headers
  });
}

export function errorHandler(
  handler: (error: unknown, request: Request, context: WebRuntimeRouteContext) => Promise<Response> | Response
): WebRuntimeMiddleware {
  return async (request, context, next) => {
    try {
      return await next();
    } catch (error) {
      return handler(error, request, context);
    }
  };
}

export function logger(): WebRuntimeMiddleware {
  return async (request, _context, next) => {
    const start = Date.now();
    const response = await next();
    console.log(`${request.method} ${request.url} - ${Date.now() - start}`);
    return response;
  };
}

export function finalWebRuntimeHandler(request?: Request): Response {
  if (!request) {
    return new Response('Cannot handle WebRuntime request', {
      status: 500
    });
  }
  const url = new URL(request.url);
  const isHead = request.method.toUpperCase() === 'HEAD';
  return new Response(isHead ? null : `Cannot ${request.method.toUpperCase()} ${url.pathname}`, {
    status: 404,
    headers: {
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'self'",
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*'
    }
  });
}

function matchesMethod(expected: string | undefined, actual: string): boolean {
  if (!expected) {
    return true;
  }
  const method = actual.toUpperCase();
  if (expected === 'GET') {
    return method === 'GET' || method === 'HEAD';
  }
  return method === expected;
}

function normalizePrefix(prefix: string): string {
  if (!prefix.startsWith('/')) {
    return `/${prefix}`;
  }
  return prefix === '/' ? '' : prefix.replace(/\/$/, '');
}

function joinPaths(base: string, path: string): string {
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const joined = `${normalizedBase}${normalizedPath}`;
  return joined || '/';
}

async function resolveCacheStore(
  context: WebRuntimeRouteContext,
  options: WebRuntimeCacheMiddlewareOptions
): Promise<{
  store: WebRuntimeCacheStore;
  match(request: Request, query?: WebRuntimeCacheQueryOptions): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}> {
  const store = options.store ?? 'service-worker';
  if (store === 'edge') {
    return {
      store,
      match(request, query) {
        return context.edgeCache.match(request, query);
      },
      put(request, response) {
        return context.edgeCache.put(request, response, {
          ttl: options.ttl,
          tags: options.tags
        });
      }
    };
  }

  const cacheName = store === 'service-worker' ? 'service-worker' : store.slice('named:'.length);
  const cache = await context.platform.caches.open(cacheName);
  return {
    store,
    match(request, query) {
      return cache.match(request, query);
    },
    put(request, response) {
      return cache.put(request, response);
    }
  };
}

async function createCacheRequest(
  request: Request,
  context: WebRuntimeRouteContext,
  options: WebRuntimeCacheMiddlewareOptions
): Promise<Request> {
  if (!options.key) {
    return request;
  }
  const url = new URL(request.url);
  const key = typeof options.key === 'function'
    ? await options.key(request, url, context)
    : options.key;
  const keyUrl = key.startsWith('http://') || key.startsWith('https://')
    ? key
    : new URL(`/__webruntime/cache/${encodeURIComponent(key)}`, context.platform.origin).href;
  return new Request(keyUrl, {
    method: request.method,
    headers: request.headers
  });
}

function recordCacheTrace(
  context: WebRuntimeRouteContext,
  boundary: WebRuntimeTraceEntry['boundary'] | undefined,
  request: Request,
  response?: Response,
  detail?: unknown
): void {
  if (!boundary) {
    return;
  }
  const trace = context.trace as PipelineTraceController;
  trace.record?.({
    boundary,
    method: request.method,
    url: request.url,
    status: response?.status,
    detail
  });
}

function matchesMount(pathname: string, prefix: string): boolean {
  if (!prefix) {
    return true;
  }
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function matchPattern(pattern: string, value: string): {
  matched: boolean;
  params: Record<string, string>;
} {
  const patternParts = pattern.split('/').filter(Boolean);
  const valueParts = value.split('/').filter(Boolean);
  const params: Record<string, string> = {};

  if (pattern === '*' || pattern === '/*') {
    return {
      matched: true,
      params
    };
  }

  if (patternParts.length !== valueParts.length) {
    return {
      matched: false,
      params
    };
  }

  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index]!;
    const valuePart = valueParts[index]!;
    if (patternPart === '*') {
      continue;
    }
    if (patternPart.startsWith(':')) {
      params[patternPart.slice(1)] = decodeURIComponent(valuePart);
      continue;
    }
    if (patternPart !== valuePart) {
      return {
        matched: false,
        params: {}
      };
    }
  }

  return {
    matched: true,
    params
  };
}

async function withRouteState<T>(
  context: WebRuntimeRouteContext,
  patch: Partial<WebRuntimeRouteContext['route']>,
  run: () => Promise<T> | T
): Promise<T> {
  const previous = {
    ...context.route,
    params: {
      ...context.route.params
    }
  };
  context.route = {
    ...context.route,
    ...patch,
    params: patch.params ?? context.route.params
  };
  try {
    return await run();
  } finally {
    context.route = previous;
  }
}
