import type { FetchApp } from '../../core/types.ts';

export const multiAppNetworkApiApp: FetchApp = {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/events') {
      return Response.json({
        source: 'api-app',
        host: url.hostname,
        events: ['start', 'done']
      });
    }
    return new Response('Not found', {
      status: 404
    });
  }
};
