import { describe, expect, it } from 'vitest';
import { createWebRuntime } from '../src/core/create-web-runtime.ts';
import { createWebRuntimeNetwork } from '../src/core/create-web-runtime-network.ts';

describe('WebRuntime platform state APIs', () => {
  it('scopes localStorage and sessionStorage per environment and clears them on reset', async () => {
    const web = await createWebRuntime({
      origin: 'https://web.local',
      environments: {
        backend: {
          mode: 'same-realm',
          location: 'https://backend.local/base'
        }
      },
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        backend: {
          kind: 'mock',
          routes: {}
        }
      }
    });

    web.platform.localStorage.setItem('shared', 'frontend');
    web.platform.sessionStorage.setItem('session', 'frontend-session');
    web.environments.backend.platform.localStorage.setItem('shared', 'backend');

    expect(web.platform.localStorage.getItem('shared')).toBe('frontend');
    expect(web.environments.backend.platform.localStorage.getItem('shared')).toBe('backend');
    expect(web.platform.sessionStorage.snapshot()).toEqual({
      session: 'frontend-session'
    });

    await web.reset();

    expect(web.platform.localStorage.length).toBe(0);
    expect(web.platform.sessionStorage.length).toBe(0);
    expect(web.environments.backend.platform.localStorage.length).toBe(0);
    expect(web.environments.backend.location.href).toBe('https://backend.local/base');
  });

  it('stores response cookies by origin and applies them to later credentialed platform fetches', async () => {
    const seenCookies: Array<string | null> = [];
    const web = await createWebRuntime({
      origin: 'https://web.local',
      app: {
        fetch(request) {
          const url = new URL(request.url);
          if (url.pathname === '/set') {
            return new Response('set', {
              headers: {
                'set-cookie': 'theme=dark; Path=/'
              }
            });
          }
          if (url.pathname === '/clear') {
            return new Response('clear', {
              headers: {
                'set-cookie': 'theme=; Max-Age=0; Path=/'
              }
            });
          }
          seenCookies.push(request.headers.get('cookie'));
          return new Response(request.headers.get('cookie') ?? '');
        }
      },
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        backend: {
          kind: 'fetch-app'
        }
      }
    });

    await web.platform.fetch('/set');
    expect(web.platform.cookies.getCookieHeader('https://web.local/echo')).toBe('theme=dark');

    await expect((await web.platform.fetch('/echo')).text()).resolves.toBe('theme=dark');
    await expect((await web.platform.fetch('/echo', {
      credentials: 'omit'
    })).text()).resolves.toBe('');
    await web.platform.fetch('/clear');
    await expect((await web.platform.fetch('/echo')).text()).resolves.toBe('');

    expect(seenCookies).toEqual([
      'theme=dark',
      null,
      null
    ]);
  });

  it('keeps cookies origin-scoped across WebRuntime instances connected through WebRuntime network', async () => {
    const network = createWebRuntimeNetwork();
    const apiWeb = await createWebRuntime({
      origin: 'https://api.local',
      app: {
        fetch(request) {
          const url = new URL(request.url);
          if (url.pathname === '/set') {
            return new Response('ok', {
              headers: {
                'set-cookie': 'api=1; Path=/'
              }
            });
          }
          return new Response(request.headers.get('cookie') ?? '');
        }
      },
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        backend: {
          kind: 'fetch-app'
        }
      }
    });
    const web = await createWebRuntime({
      origin: 'https://web.local',
      network,
      app: {
        fetch(request) {
          return new Response(request.headers.get('cookie') ?? '');
        }
      },
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        network: {
          kind: 'web-runtime-network'
        },
        backend: {
          kind: 'fetch-app'
        }
      }
    });
    network.register('https://api.local', apiWeb);
    network.register('https://web.local', web);

    await web.platform.fetch('https://api.local/set');

    await expect((await web.platform.fetch('https://api.local/check')).text()).resolves.toBe('api=1');
    await expect((await web.platform.fetch('/local')).text()).resolves.toBe('');
  });

  it('provides CacheStorage-style named caches and clears them on reset', async () => {
    const web = await createWebRuntime({
      origin: 'https://web.local',
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        backend: {
          kind: 'mock',
          routes: {}
        }
      }
    });
    const cache = await web.platform.caches.open('pages');
    await cache.put('https://web.local/cached?x=1', new Response('cached'));

    await expect((await cache.match('https://web.local/cached?x=1'))?.text()).resolves.toBe('cached');
    await expect((await web.platform.caches.match('https://web.local/cached?x=2', {
      ignoreSearch: true
    }))?.text()).resolves.toBe('cached');
    expect(await web.platform.caches.keys()).toEqual(['pages']);

    await web.reset();

    expect(await web.platform.caches.keys()).toEqual([]);
  });

  it('allows fake service worker routes to short-circuit repeated requests with context platform caches', async () => {
    let originHits = 0;
    const web = await createWebRuntime({
      origin: 'https://web.local',
      app: {
        async fetch(request, _env, context) {
          const cache = await context.platform.caches.open('api');
          const cached = await cache.match(request);
          if (cached) {
            return cached;
          }
          originHits += 1;
          const response = Response.json({
            originHits
          });
          await cache.put(request, response.clone());
          return response;
        }
      },
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'fake',
          routes: [
            {
              pattern: '/api/data',
              async handler(request, context, next) {
                const cache = await context.platform.caches.open('api');
                const cached = await cache.match(request);
                if (cached) {
                  return cached;
                }
                const response = await next();
                await cache.put(request, response.clone());
                return response;
              }
            }
          ]
        },
        backend: {
          kind: 'fetch-app'
        }
      }
    });

    await expect((await web.fetch('/api/data')).json()).resolves.toEqual({
      originHits: 1
    });
    await expect((await web.fetch('/api/data')).json()).resolves.toEqual({
      originHits: 1
    });
    expect(originHits).toBe(1);
    const boundaries = web.trace.entries().map((entry) => entry.boundary);
    expect(boundaries.filter((boundary) => boundary === 'service-worker:request')).toHaveLength(2);
    expect(boundaries.filter((boundary) => boundary === 'backend:request')).toHaveLength(1);
  });
});
