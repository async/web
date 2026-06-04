import type { FetchApp } from '../../core/types.ts';

export const requestBodyLabBackendApp: FetchApp = {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/echo') {
      return Response.json({
        method: request.method,
        body: await request.text()
      });
    }
    return new Response('Not found', {
      status: 404
    });
  }
};
