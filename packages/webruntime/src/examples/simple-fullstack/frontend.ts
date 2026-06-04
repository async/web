import type { FetchApp } from '../../core/types.ts';

export const simpleFrontendApp: FetchApp = {
  async fetch() {
    return new Response(`
      <!doctype html>
      <html>
        <head>
          <title>Simple Fullstack</title>
        </head>
        <body>
          <h1>Simple Fullstack</h1>
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
