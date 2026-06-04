import type { FetchApp } from '../../core/types.ts';

export const platformFetchChainBackendApp: FetchApp = {
  async fetch(request, _env, context) {
    const url = new URL(request.url);
    if (url.pathname === '/inner') {
      return Response.json({
        source: 'inner',
        path: url.pathname
      });
    }
    if (url.pathname === '/outer') {
      const inner = await context.platform.fetch('inner');
      return Response.json({
        source: 'outer',
        inner: await inner.json()
      });
    }
    return new Response('Not found', {
      status: 404
    });
  }
};
