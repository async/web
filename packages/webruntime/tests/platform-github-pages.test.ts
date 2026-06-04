import { describe, expect, it } from 'vitest';
import { createWebRuntime } from '../src/core/create-web-runtime.ts';

describe('WebRuntime GitHub Pages-style self communication', () => {
  it('lets frontend code talk to bundled browser-safe app.fetch code through platform.fetch', async () => {
    const web = await createWebRuntime({
      origin: 'https://example.github.io',
      app: {
        async fetch(request, _env, context) {
          const url = new URL(request.url);
          if (url.pathname === '/') {
            return new Response('<!doctype html><h1>Static WebRuntime App</h1>', {
              headers: {
                'content-type': 'text/html; charset=utf-8'
              }
            });
          }
          if (url.pathname === '/api/session') {
            context.platform.localStorage.setItem('last-api', url.pathname);
            return Response.json({
              source: 'bundled-app-fetch',
              platform: context.platform.name,
              cookie: request.headers.get('cookie') ?? null
            }, {
              headers: {
                'set-cookie': 'session=static-demo; Path=/'
              }
            });
          }
          if (url.pathname === '/api/again') {
            return Response.json({
              lastApi: context.platform.localStorage.getItem('last-api'),
              cookie: request.headers.get('cookie') ?? null
            });
          }
          return new Response('Not found', {
            status: 404
          });
        }
      },
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'fake'
        },
        network: {
          kind: 'blocked'
        },
        edge: {
          kind: 'bypass'
        },
        backend: {
          kind: 'fetch-app'
        }
      }
    });

    await expect((await web.navigate('/')).text()).resolves.toContain('Static WebRuntime App');

    const frontendFetch = web.platform.createFetch();
    const first = await frontendFetch('/api/session');
    await expect(first.json()).resolves.toEqual({
      source: 'bundled-app-fetch',
      platform: 'backend',
      cookie: null
    });

    const second = await frontendFetch('/api/again');
    await expect(second.json()).resolves.toEqual({
      lastApi: '/api/session',
      cookie: 'session=static-demo'
    });

    const boundaries = web.trace.entries().map((entry) => entry.boundary);
    expect(boundaries).toContain('frontend:request');
    expect(boundaries).toContain('service-worker:request');
    expect(boundaries).toContain('network:request');
    expect(boundaries).toContain('backend:request');
    expect(boundaries).not.toContain('web-runtime-network:request');
  });
});
