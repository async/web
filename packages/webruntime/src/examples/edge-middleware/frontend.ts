import type { FetchApp } from '../../core/types.ts';

export const edgeMiddlewareFrontendApp: FetchApp = {
  async fetch() {
    return new Response(`
      <!doctype html>
      <html>
        <head>
          <title>Edge Middleware</title>
        </head>
        <body>
          <h1>Edge Middleware</h1>
          <a href="/docs">Docs</a>
        </body>
      </html>
    `, {
      headers: {
        'content-type': 'text/html; charset=utf-8'
      }
    });
  }
};
