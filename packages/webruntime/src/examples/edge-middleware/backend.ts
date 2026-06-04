import type { FetchApp } from '../../core/types.ts';

export const edgeMiddlewareBackendApp: FetchApp = {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/docs/index') {
      return new Response(`
        <!doctype html>
        <html>
          <head>
            <title>Docs</title>
          </head>
          <body>
            <h1>Docs</h1>
          </body>
        </html>
      `, {
        headers: {
          'content-type': 'text/html; charset=utf-8'
        }
      });
    }
    if (url.pathname === '/new') {
      return new Response('<h1>New</h1>', {
        headers: {
          'content-type': 'text/html; charset=utf-8'
        }
      });
    }
    return new Response('Not found', {
      status: 404
    });
  }
};
