import type { FetchApp } from '../../core/types.ts';

export const serviceWorkerCacheFrontendApp: FetchApp = {
  async fetch() {
    return new Response(`
      <!doctype html>
      <html>
        <head>
          <title>Service Worker Cache</title>
        </head>
        <body>
          <h1>Service Worker Cache</h1>
          <button id="load-message">Load message</button>
        </body>
      </html>
    `, {
      headers: {
        'content-type': 'text/html; charset=utf-8'
      }
    });
  }
};
