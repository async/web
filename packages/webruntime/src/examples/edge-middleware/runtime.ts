import { createWebRuntimeApp } from '../../core/define-runtime.ts';
import {
  get,
  middleware,
  redirect,
  toApp
} from '../../core/routes.ts';
import { edgeMiddlewareBackendApp } from './backend.ts';
import { edgeMiddlewareFrontendApp } from './frontend.ts';

export const edgeMiddlewareWebRuntime = createWebRuntimeApp({
  origin: 'https://edge-middleware.local',
  apps: {
    frontend: {
      app: edgeMiddlewareFrontendApp,
      basePath: '/'
    },
    backend: {
      app: edgeMiddlewareBackendApp,
      basePath: '/'
    }
  },
  routes: [
    get('/old', redirect('/new', 302)),
    middleware(() => true, async (request, _context, next) => {
      const response = await next();
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html')) {
        return response;
      }
      const html = await response.text();
      return new Response(html.replace('</head>', '<meta name="edge" content="middleware"></head>'), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    }),
    middleware((_request, url) => url.pathname === '/docs', (request, _context, next) => {
      const rewriteUrl = new URL(request.url);
      rewriteUrl.pathname = '/docs/index';
      return next(new Request(rewriteUrl, request));
    }),
    middleware((_request, url) => url.pathname === '/' || url.pathname === '/index.html', toApp('frontend')),
    toApp('backend')
  ]
});
