import type { FetchApp } from '../../core/types.ts';

export const statefulSessionCacheBackendApp: FetchApp = {
  async fetch(request, _env, context) {
    const url = new URL(request.url);
    if (url.pathname === '/session') {
      context.platform.cookies.setCookie(request.url, 'seen=true; Path=/');
      return Response.json({
        cookie: context.platform.cookies.getCookieHeader(request.url)
      });
    }
    if (url.pathname === '/cache') {
      const cache = await context.platform.caches.open('stateful-session');
      const cached = await cache.match(request);
      if (cached) {
        const data = await cached.json();
        return Response.json({
          cacheHit: true,
          value: data.value
        });
      }
      const value = Number(context.platform.localStorage.getItem('value') ?? '0') + 1;
      context.platform.localStorage.setItem('value', String(value));
      const response = Response.json({
        cacheHit: false,
        value
      });
      await cache.put(request, response.clone());
      return response;
    }
    return new Response('Not found', {
      status: 404
    });
  }
};
