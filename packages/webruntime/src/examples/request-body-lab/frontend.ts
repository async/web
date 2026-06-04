import type { FetchApp } from '../../core/types.ts';

export const requestBodyLabFrontendApp: FetchApp = {
  async fetch() {
    return new Response(`
      <!doctype html>
      <html>
        <head>
          <title>Request Body Lab</title>
        </head>
        <body>
          <h1>Request Body Lab</h1>
          <form action="/api/echo" method="post">
            <textarea name="message">hello</textarea>
            <button>Echo</button>
          </form>
        </body>
      </html>
    `, {
      headers: {
        'content-type': 'text/html; charset=utf-8'
      }
    });
  }
};
