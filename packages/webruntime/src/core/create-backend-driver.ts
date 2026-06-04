import type {
  BackendLayerConfig,
  FetchApp,
  WebRuntimeBackendDriver,
  WebRuntimeContext,
  WebRuntimeEnv,
  MockRouteHandler
} from './types.ts';

export function createBackendDriver(options: {
  config: BackendLayerConfig;
  app?: FetchApp;
  env: WebRuntimeEnv;
  context: WebRuntimeContext;
}): WebRuntimeBackendDriver {
  const { config, app, env, context } = options;

  if (config.kind === 'fetch-app' && !app) {
    throw new Error('WebRuntime fetch-app backend requires config.app');
  }

  return {
    async fetch(request) {
      if (config.kind === 'fetch-app') {
        return await app!.fetch(request, env, context);
      }

      if (config.kind === 'http-proxy') {
        return proxyRequest(request, config.targetOrigin);
      }

      return matchMockRoute(config.routes, request, context);
    }
  };
}

export async function proxyRequest(request: Request, targetOrigin: string): Promise<Response> {
  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(targetOrigin);
  targetUrl.pathname = sourceUrl.pathname;
  targetUrl.search = sourceUrl.search;

  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers: request.headers
  };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
    init.duplex = 'half';
  }

  return fetch(targetUrl, init);
}

export async function matchMockRoute(
  routes: Record<string, MockRouteHandler>,
  request: Request,
  context: WebRuntimeContext
): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  for (const [route, handler] of Object.entries(routes)) {
    if (route === pathname || (route.endsWith('/') && pathname.startsWith(route))) {
      return handler(request, context);
    }
  }
  return new Response('Not found', {
    status: 404
  });
}
