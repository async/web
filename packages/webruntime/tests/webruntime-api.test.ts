import { describe, expect, it, vi } from 'vitest';
import {
  cacheFirst,
  createAsyncDbApp,
  createFetchApp,
  createWebRuntime,
  defineRuntime,
  mount,
  toApp,
  toOrigin,
  tryApp
} from '../src/index.ts';

describe('WebRuntime public API', () => {
  it('dispatches mounted apps through defineRuntime and createWebRuntime', async () => {
    const runtime = defineRuntime({
      origin: 'https://runtime.local',
      apps: {
        frontend: {
          fetch: () => new Response('frontend'),
          basePath: '/'
        },
        db: {
          fetch: (request) => Response.json({
            pathname: new URL(request.url).pathname
          }),
          runtime: 'async-db',
          basePath: '/db/'
        }
      },
      routes: [
        mount('/db', toApp('db')),
        toApp('frontend')
      ]
    });
    const web = await createWebRuntime(runtime);

    await expect((await web.fetch('/')).text()).resolves.toBe('frontend');
    await expect((await web.fetch('/db/users')).json()).resolves.toEqual({
      pathname: '/users'
    });
  });

  it('passes AsyncDB operation contract context through the runtime adapter placeholder', async () => {
    const runtime = defineRuntime({
      origin: 'https://runtime.local',
      apps: {
        db: {
          app: createAsyncDbApp({
            config: {
              owner: '@async/db'
            },
            basePath: '/db/',
            operations: {
              contract: 'public',
              registeredOnly: true
            },
            contracts: {
              public: {
                operations: ['GetUser']
              }
            }
          }),
          runtime: 'async-db',
          basePath: '/db/'
        }
      },
      routes: [
        mount('/db', toApp('db'))
      ]
    });
    const web = await createWebRuntime(runtime);

    await expect((await web.fetch('/db/users')).json()).resolves.toMatchObject({
      ok: false,
      registeredOnly: true,
      contract: 'public'
    });
    await expect((await web.fetch('/db/operations/GetUser')).json()).resolves.toMatchObject({
      operationRef: 'GetUser',
      contract: 'public'
    });
    expect(web.trace.entries().some((entry) => (
      entry.detail
      && typeof entry.detail === 'object'
      && (entry.detail as Record<string, unknown>).adapter === 'async-db'
      && (entry.detail as Record<string, unknown>).contract === 'public'
    ))).toBe(true);
  });

  it('caches route responses with cacheFirst', async () => {
    let hits = 0;
    const web = await createWebRuntime(defineRuntime({
      origin: 'https://runtime.local',
      apps: {
        frontend: {
          app: createFetchApp(() => new Response(`hit:${++hits}`)),
          basePath: '/'
        }
      },
      routes: [
        cacheFirst({
          store: 'edge',
          ttl: 30
        }),
        toApp('frontend')
      ]
    }));

    await expect((await web.fetch('/cached')).text()).resolves.toBe('hit:1');
    await expect((await web.fetch('/cached')).text()).resolves.toBe('hit:1');
    expect(hits).toBe(1);
  });

  it('can proxy a route to an origin', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('origin'));
    const web = await createWebRuntime(defineRuntime({
      origin: 'https://runtime.local',
      apps: {
        frontend: {
          app: createFetchApp(() => new Response('frontend')),
          basePath: '/'
        }
      },
      routes: [
        mount('/origin', toOrigin('https://origin.local/base/')),
        toApp('frontend')
      ]
    }));

    await expect((await web.fetch('/origin/items?limit=1')).text()).resolves.toBe('origin');
    expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://origin.local/base/items?limit=1'
    }));
    fetchSpy.mockRestore();
  });

  it('lets platform.fetch re-enter the route graph', async () => {
    const web = await createWebRuntime(defineRuntime({
      origin: 'https://runtime.local',
      apps: {
        frontend: {
          app: createFetchApp((_request, _env, context) => {
            return context.platform.fetch('/api/value');
          }),
          basePath: '/'
        },
        api: {
          app: createFetchApp(() => Response.json({
            ok: true
          })),
          runtime: 'origin',
          basePath: '/api/'
        }
      },
      routes: [
        mount('/api', toApp('api')),
        toApp('frontend')
      ]
    }));

    await expect((await web.fetch('/')).json()).resolves.toEqual({
      ok: true
    });
  });

  it('tries app candidates in order and falls through on configured statuses', async () => {
    const web = await createWebRuntime(defineRuntime({
      origin: 'https://runtime.local',
      apps: {
        frontend: {
          app: createFetchApp(() => new Response('frontend')),
          basePath: '/'
        },
        bff: {
          app: createFetchApp(() => new Response('missing', {
            status: 404
          })),
          basePath: '/api/'
        },
        api: {
          app: createFetchApp((request) => {
            return new URL(request.url).pathname === '/users'
              ? Response.json({
                from: 'api'
              })
              : new Response('api missing', {
                status: 404
              });
          }),
          basePath: '/api/'
        }
      },
      routes: [
        mount('/api', tryApp({}, [
          toApp('bff'),
          toApp('api')
        ])),
        toApp('frontend')
      ]
    }));

    await expect((await web.fetch('/api/users')).json()).resolves.toEqual({
      from: 'api'
    });
    await expect((await web.fetch('/api/missing')).text()).resolves.toBe('frontend');
  });

  it('mounts the AsyncDB adapter placeholder without owning AsyncDB data contracts', async () => {
    const dbConfig = {
      owner: '@async/db',
      manifest: 'db.config.mjs'
    };
    const db = createAsyncDbApp({
      config: dbConfig,
      runtime: 'async-db',
      basePath: '/db/',
      viewerPath: '/__db/'
    });
    const web = await createWebRuntime(defineRuntime({
      origin: 'https://runtime.local',
      apps: {
        frontend: {
          app: createFetchApp(() => new Response('frontend')),
          basePath: '/'
        },
        db: {
          app: db,
          runtime: 'async-db',
          basePath: '/db/'
        }
      },
      routes: [
        mount('/db', toApp('db')),
        toApp('frontend')
      ]
    }));

    const response = await web.fetch('/db/users');

    expect(response.status).toBe(501);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      runtime: 'async-db'
    });
  });
});
