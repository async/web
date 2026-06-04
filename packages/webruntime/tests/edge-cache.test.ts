import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEdgeCache } from '../src/core/create-edge-cache.ts';
import { createWebRuntime } from '../src/core/create-web-runtime.ts';
import type { EdgeWorker } from '../src/core/types.ts';

describe('edge cache', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('caches, serves cache hits, and purges by tag', async () => {
    let originHits = 0;
    const worker: EdgeWorker = {
      async fetch(request, _env, context) {
        const cached = await context.edgeCache.match(request);
        if (cached) {
          return cached;
        }
        const response = await context.next(request);
        await context.edgeCache.put(request, response.clone(), {
          ttl: 60,
          tags: ['layout:main']
        });
        return response;
      }
    };
    const web = await createWebRuntime({
      origin: 'http://localhost:3000',
      app: {
        fetch() {
          originHits += 1;
          return new Response(`hit:${originHits}`, {
            headers: {
              'cache-control': 's-maxage=60'
            }
          });
        }
      },
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        edge: {
          kind: 'fake',
          worker,
          cache: {
            enabled: true,
            defaultTtl: 60,
            respectCacheControl: true
          }
        },
        backend: {
          kind: 'fetch-app'
        }
      }
    });

    await expect((await web.fetch('/')).text()).resolves.toBe('hit:1');
    await expect((await web.fetch('/')).text()).resolves.toBe('hit:1');
    expect(originHits).toBe(1);
    expect(await web.edge.cache.purgeByTag('layout:main')).toBe(1);
    await expect((await web.fetch('/')).text()).resolves.toBe('hit:2');

    const boundaries = web.trace.entries().map((entry) => entry.boundary);
    expect(boundaries).toContain('edge:cache-miss');
    expect(boundaries).toContain('edge:cache-hit');
  });

  it('matches configured Vary request headers', async () => {
    const worker: EdgeWorker = {
      async fetch(request, _env, context) {
        const cached = await context.edgeCache.match(request);
        if (cached) {
          return cached;
        }
        const variant = request.headers.get('x-variant') ?? 'none';
        const response = new Response(`variant:${variant}`);
        await context.edgeCache.put(request, response.clone(), {
          ttl: 60,
          vary: ['x-variant']
        });
        return response;
      }
    };
    const web = await createWebRuntime({
      origin: 'http://localhost:3000',
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        edge: {
          kind: 'fake',
          worker,
          cache: {
            enabled: true,
            defaultTtl: 60
          }
        },
        backend: {
          kind: 'mock',
          routes: {}
        }
      }
    });

    await expect((await web.fetch('/', {
      headers: {
        'x-variant': 'a'
      }
    })).text()).resolves.toBe('variant:a');
    await expect((await web.fetch('/', {
      headers: {
        'x-variant': 'b'
      }
    })).text()).resolves.toBe('variant:b');
    await expect((await web.fetch('/', {
      headers: {
        'x-variant': 'a'
      }
    })).text()).resolves.toBe('variant:a');
  });

  it('respects cache-control no-store and s-maxage over max-age', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const cache = createEdgeCache({
      respectCacheControl: true
    });
    const request = new Request('http://localhost:3000/page');

    await cache.put(request, new Response('private', {
      headers: {
        'cache-control': 'no-store'
      }
    }));
    expect(await cache.match(request)).toBeUndefined();

    await cache.put(request, new Response('public', {
      headers: {
        'cache-control': 'max-age=5, s-maxage=20'
      }
    }));
    expect((await cache.keys())[0]?.expiresAt).toBe(Date.now() + 20_000);

    vi.setSystemTime(new Date(Date.now() + 6_000));
    await expect((await cache.match(request))?.text()).resolves.toBe('public');

    vi.setSystemTime(new Date(Date.now() + 15_000));
    expect(await cache.match(request)).toBeUndefined();
    expect(await cache.keys()).toEqual([]);
  });

  it('supports HEAD caching, delete, path purge, purge all, and ignore match options', async () => {
    const cache = createEdgeCache({
      defaultTtl: 60
    });
    const getA = new Request('http://localhost:3000/assets/app.js?v=a');
    const getB = new Request('http://localhost:3000/assets/app.js?v=b');
    const headA = new Request('http://localhost:3000/assets/app.js?v=a', {
      method: 'HEAD'
    });

    await cache.put(getA, new Response('get-a'));
    await cache.put(getB, new Response('get-b'));
    await cache.put(headA, new Response(null));

    expect(await cache.keys()).toHaveLength(3);
    expect((await cache.match(new Request('http://localhost:3000/assets/app.js'), {
      ignoreSearch: true
    }))?.status).toBe(200);
    expect(await cache.match(headA)).toBeDefined();
    expect(await cache.match(headA, {
      ignoreMethod: true
    })).toBeDefined();

    expect(await cache.delete(getA)).toBe(true);
    expect(await cache.keys()).toHaveLength(2);
    expect(await cache.purgeByPath('/assets/app.js')).toBe(2);
    expect(await cache.keys()).toHaveLength(0);

    await cache.put(new Request('http://localhost:3000/one'), new Response('one'));
    await cache.put(new Request('http://localhost:3000/two'), new Response('two'));
    await cache.purgeAll();

    expect(await cache.keys()).toEqual([]);
  });
});
