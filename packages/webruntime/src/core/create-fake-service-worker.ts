import { contentTypeForPath } from './content-type.ts';
import { normalizeWebRuntimePath } from './path-utils.ts';
import type { WebRuntimeContext } from './types.ts';

export interface FakeServiceWorker {
  route(pattern: string | RegExp | FakeRouteMatcher, handler: FakeRouteHandler): void;
  addEventListener(type: 'fetch', listener: FakeFetchEventListener): void;
  dispatchFetch(
    request: Request,
    context: WebRuntimeContext,
    next: () => Promise<Response> | Response
  ): Promise<Response>;
}

export type FakeRouteMatcher = (url: URL, request: Request) => boolean;

export type FakeRouteHandler = (
  request: Request,
  context: WebRuntimeContext,
  next: () => Promise<Response> | Response
) => Promise<Response> | Response;

export type FakeFetchEventListener = (event: FakeFetchEvent) => void;

export interface FakeFetchEvent {
  readonly request: Request;
  respondWith(response: Promise<Response> | Response): void;
}

interface Route {
  pattern: string | RegExp | FakeRouteMatcher;
  handler: FakeRouteHandler;
  builtIn?: boolean;
}

export function createFakeServiceWorker(): FakeServiceWorker {
  const routes: Route[] = [];
  const listeners = new Set<FakeFetchEventListener>();

  const worker: FakeServiceWorker = {
    route(pattern, handler, builtIn = false) {
      routes.push({
        pattern,
        handler,
        builtIn
      });
    },
    addEventListener(type, listener) {
      if (type === 'fetch') {
        listeners.add(listener);
      }
    },
    async dispatchFetch(request, context, next) {
      let respondedWith: Promise<Response> | Response | undefined;
      const event: FakeFetchEvent = {
        request,
        respondWith(response) {
          respondedWith = response;
        }
      };

      for (const listener of listeners) {
        listener(event);
      }
      if (respondedWith) {
        return respondedWith;
      }

      const url = new URL(request.url);
      for (const route of [...routes].sort((a, b) => Number(a.builtIn ?? false) - Number(b.builtIn ?? false))) {
        if (matchesRoute(route.pattern, url, request)) {
          return route.handler(request, context, next);
        }
      }
      return next();
    }
  };

  installBuiltInRoutes(worker);
  return worker;
}

function installBuiltInRoutes(worker: FakeServiceWorker): void {
  const workerWithRoutes = worker as FakeServiceWorker & {
    route(pattern: string | RegExp | FakeRouteMatcher, handler: FakeRouteHandler, builtIn?: boolean): void;
  };

  workerWithRoutes.route('/__webruntime/files/', async (request, context) => {
    const url = new URL(request.url);
    const rawPath = url.pathname.slice('/__webruntime/files'.length);
    const filePath = normalizeWebRuntimePath(rawPath);
    if (!(await context.fs.exists(filePath))) {
      return new Response('Not found', {
        status: 404
      });
    }
    return new Response(await context.fs.readFile(filePath), {
      headers: {
        'content-type': contentTypeForPath(filePath)
      }
    });
  }, true);
  workerWithRoutes.route('/api/', async (_request, _context, next) => next(), true);
  workerWithRoutes.route('/', async (_request, _context, next) => next(), true);
}

function matchesRoute(
  pattern: string | RegExp | FakeRouteMatcher,
  url: URL,
  request: Request
): boolean {
  if (typeof pattern === 'function') {
    return pattern(url, request);
  }
  if (pattern instanceof RegExp) {
    return pattern.test(url.href) || pattern.test(url.pathname);
  }
  return pattern.endsWith('/')
    ? url.pathname.startsWith(pattern)
    : url.pathname === pattern;
}
