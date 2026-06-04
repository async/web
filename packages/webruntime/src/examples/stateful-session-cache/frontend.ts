import type { FetchApp } from '../../core/types.ts';

export const statefulSessionCacheFrontendApp: FetchApp = {
  async fetch() {
    return new Response(`
      <!doctype html>
      <html>
        <head>
          <title>Stateful Session Cache</title>
        </head>
        <body>
          <h1>Stateful Session Cache</h1>
          <a href="/api/session">Set session cookie</a>
          <a href="/api/cache">Read named cache</a>
        </body>
      </html>
    `, {
      headers: {
        'content-type': 'text/html; charset=utf-8'
      }
    });
  }
};
