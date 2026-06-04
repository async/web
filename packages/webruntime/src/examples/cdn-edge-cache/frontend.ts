import type { FetchApp } from '../../core/types.ts';

export const cdnEdgeCacheFrontendApp: FetchApp = {
  async fetch() {
    return new Response(`
      <!doctype html>
      <html>
        <head>
          <title>CDN Cache</title>
        </head>
        <body>
          <h1>CDN Cache</h1>
          <a href="/api/page">Cached API</a>
        </body>
      </html>
    `, {
      headers: {
        'content-type': 'text/html; charset=utf-8'
      }
    });
  }
};
