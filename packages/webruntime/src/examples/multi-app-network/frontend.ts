import type { FetchApp } from '../../core/types.ts';

export const multiAppNetworkFrontendApp: FetchApp = {
  async fetch() {
    return new Response(`
      <!doctype html>
      <html>
        <head>
          <title>Multi App Network</title>
        </head>
        <body>
          <h1>Multi App Network</h1>
          <a href="https://api.local/events">API events</a>
        </body>
      </html>
    `, {
      headers: {
        'content-type': 'text/html; charset=utf-8'
      }
    });
  }
};
