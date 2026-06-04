import type { FetchApp } from '../../core/types.ts';

export const helloServer: FetchApp = {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/') {
      return new Response(`
        <!doctype html>
        <html>
          <head>
            <title>Hello App</title>
          </head>
          <body>
            <h1>Home</h1>
            <a href="/about">About</a>
            <a href="/api/time">API Time</a>
          </body>
        </html>
      `, {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 's-maxage=60'
        }
      });
    }
    if (url.pathname === '/about') {
      return new Response(`
        <!doctype html>
        <html>
          <head>
            <title>About</title>
          </head>
          <body>
            <h1>About</h1>
            <a href="/">Home</a>
          </body>
        </html>
      `, {
        headers: {
          'content-type': 'text/html; charset=utf-8'
        }
      });
    }
    if (url.pathname === '/api/time') {
      return Response.json({
        now: new Date().toISOString(),
        source: 'fake-node'
      });
    }
    return new Response('Not found', {
      status: 404
    });
  }
};
