import type { FetchApp } from '../../core/types.ts';

export const cdnEdgeCacheBackendApp: FetchApp = {
  async fetch(request, _env, context) {
    const url = new URL(request.url);
    if (url.pathname === '/page') {
      const hits = Number(context.platform.localStorage.getItem('originHits') ?? '0') + 1;
      context.platform.localStorage.setItem('originHits', String(hits));
      return Response.json({
        source: 'cdn-edge-cache-backend',
        originHits: hits
      }, {
        headers: {
          'cache-control': 's-maxage=60'
        }
      });
    }
    return new Response('Not found', {
      status: 404
    });
  }
};
