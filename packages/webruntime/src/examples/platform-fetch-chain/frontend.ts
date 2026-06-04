import type { FetchApp } from '../../core/types.ts';

export const platformFetchChainFrontendApp: FetchApp = {
  async fetch() {
    return new Response(`
      <!doctype html>
      <html>
        <head>
          <title>Platform Fetch Chain</title>
        </head>
        <body>
          <h1>Platform Fetch Chain</h1>
          <p>The backend calls another backend route with platform.fetch().</p>
          <a href="/api/outer">Run chain</a>
        </body>
      </html>
    `, {
      headers: {
        'content-type': 'text/html; charset=utf-8'
      }
    });
  }
};
