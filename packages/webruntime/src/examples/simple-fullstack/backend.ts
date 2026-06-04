import type { FetchApp } from '../../core/types.ts';

export const simpleBackendApp: FetchApp = {
  async fetch(request, _env, context) {
    const url = new URL(request.url);
    if (url.pathname === '/message') {
      return Response.json({
        source: 'backend',
        path: url.pathname
      });
    }
    if (url.pathname === '/platform-state') {
      context.platform.localStorage.setItem('owner', 'backend');
      return Response.json({
        owner: context.platform.localStorage.getItem('owner'),
        location: context.platform.location.href
      });
    }
    if (url.pathname === '/platform-again') {
      return Response.json({
        owner: context.platform.localStorage.getItem('owner')
      });
    }
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
    if (url.pathname === '/runtime') {
      return Response.json({
        mode: context.environment.execution.mode,
        location: context.environment.location.href,
        sandbox: context.environment.execution.mode === 'iframe'
          ? context.environment.execution.sandbox ?? null
          : null
      });
    }
    return new Response('Not found', {
      status: 404
    });
  }
};
