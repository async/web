import { createWebRuntime } from '@async/webruntime';
import {
  asyncDbApp,
  asyncWebDefaultConfig,
  browserApp,
  buildEnv,
  cacheFirst,
  defineApp,
  envValue,
  fetchApp,
  mount,
  remoteApp,
  resolveDevPorts,
  resolveEnvValue,
  toApp,
  toOrigin,
  tryApp,
  toWebRuntimeConfig
} from '../src/index.ts';

describe('@async/web defineApp', () => {
  it('uses the default config as the internal app baseline', () => {
    const app = defineApp({});
    const runtime = toWebRuntimeConfig(app);

    expect(app.defaults).toBe(asyncWebDefaultConfig);
    expect(app.name).toBe(asyncWebDefaultConfig.name);
    expect(runtime.origin).toBe(`https://${asyncWebDefaultConfig.name}.${asyncWebDefaultConfig.originHostSuffix}`);
    expect(runtime.apps.web).toMatchObject({
      runtime: asyncWebDefaultConfig.apps.web.runtime,
      basePath: asyncWebDefaultConfig.apps.web.basePath
    });
    expect(runtime.apps.frontend).toBeUndefined();
    expect(runtime.routes).toHaveLength(1);
  });

  it('keeps user-defined apps separate from internal defaults', () => {
    const app = defineApp({
      name: 'crm',
      apps: {
        edge: {
          fetch() {
            return new Response('edge');
          }
        },
        api: {
          basePath: '/v1/',
          fetch() {
            return new Response('user api');
          }
        }
      },
      api: {
        fetch() {
          return new Response('shortcut api');
        }
      }
    });
    const runtime = toWebRuntimeConfig(app);

    expect(runtime.apps.edge).toMatchObject({
      runtime: asyncWebDefaultConfig.apps.other.runtime,
      basePath: '/edge/'
    });
    expect(runtime.apps.api).toMatchObject({
      runtime: asyncWebDefaultConfig.apps.api.runtime,
      basePath: '/v1/'
    });
  });

  it('lowers topology-first apps and routes into a WebRuntime config', async () => {
    const app = defineApp({
      origin: 'https://crm.acme.async.run',
      apps: {
        web: browserApp({
          document: './web/index.html',
          basePath: '/',
          assets: {
            './web/index.html': '<main>web shell</main>'
          }
        }),
        api: {
          runtime: 'origin',
          basePath: '/api/',
          fetch() {
            return Response.json({
              ok: true
            });
          }
        }
      },
      routes: [
        mount('/api', toApp('api')),
        toApp('web')
      ]
    });

    expect(app.type).toBe('async-web-app');
    expect(app.routes[0]).toMatchObject({
      type: 'mount',
      path: '/api'
    });

    const runtime = toWebRuntimeConfig(app);
    expect(runtime.origin).toBe('https://crm.acme.async.run');
    expect(Object.keys(runtime.apps)).toEqual([
      'web',
      'api'
    ]);

    const web = await createWebRuntime(runtime);
    await expect((await web.fetch('/')).text()).resolves.toBe('<main>web shell</main>');
    await expect((await web.fetch('/api/health')).json()).resolves.toEqual({
      ok: true
    });
  });

  it('composes child app definitions through the root route graph', async () => {
    const crm = defineApp({
      name: 'crm',
      dev: {
        port: 4101,
        strictPort: false
      },
      apps: {
        web: fetchApp({
          fetch() {
            return new Response('crm web');
          }
        })
      },
      routes: [
        toApp('web')
      ]
    });
    const root = defineApp({
      origin: 'https://acme.async.local',
      apps: {
        crm,
        admin: {
          dev: {
            port: 4101
          },
          fetch() {
            return new Response('admin');
          }
        }
      },
      routes: [
        mount('/crm', toApp('crm')),
        mount('/admin', toApp('admin'))
      ]
    });

    const web = await createWebRuntime(toWebRuntimeConfig(root));
    await expect((await web.fetch('/crm/')).text()).resolves.toBe('crm web');
    await expect((await web.fetch('/admin/')).text()).resolves.toBe('admin');

    expect(resolveDevPorts(root, {
      occupiedPorts: [
        4100
      ]
    })).toEqual([
      {
        app: 'acme',
        preferredPort: 4100,
        port: 4101,
        strictPort: false
      },
      {
        app: 'crm',
        preferredPort: 4101,
        port: 4102,
        strictPort: false
      },
      {
        app: 'admin',
        preferredPort: 4101,
        port: 4103,
        strictPort: false
      }
    ]);
  });

  it('lowers browserApp descriptors into browser runtime fetch apps', async () => {
    const app = defineApp({
      name: 'suite',
      apps: {
        crm: browserApp({
          document: './apps/crm/index.html',
          basePath: '/crm/',
          fallback: 'spa',
          assets: {
            './apps/crm/index.html': '<main>CRM</main>',
            './apps/crm/favicon.ico': 'ico'
          }
        }),
        admin: browserApp({
          document: './apps/admin/index.html',
          basePath: '/admin/',
          assets: {
            './apps/admin/index.html': '<main>Admin</main>'
          }
        })
      },
      routes: [
        mount('/crm', toApp('crm')),
        mount('/admin', toApp('admin'))
      ]
    });

    const runtime = toWebRuntimeConfig(app);
    expect(runtime.apps.crm).toMatchObject({
      runtime: 'browser',
      basePath: '/crm/'
    });
    expect(runtime.apps.admin).toMatchObject({
      runtime: 'browser',
      basePath: '/admin/'
    });

    const web = await createWebRuntime(runtime);
    await expect((await web.fetch('/crm/')).text()).resolves.toBe('<main>CRM</main>');
    await expect((await web.fetch('/crm/dashboard')).text()).resolves.toBe('<main>CRM</main>');
    await expect((await web.fetch('/crm/favicon.ico')).text()).resolves.toBe('ico');
    expect((await web.fetch('/crm/missing.png')).status).toBe(404);
    await expect((await web.fetch('/admin/')).text()).resolves.toBe('<main>Admin</main>');
  });

  it('preserves fetchApp runtime, base path, and explicit fetch handler', async () => {
    const explicitFetch = vi.fn(() => new Response('explicit'));
    const app = defineApp({
      name: 'crm',
      apps: {
        api: fetchApp({
          runtime: 'edge',
          basePath: '/v1/',
          fetch: explicitFetch
        })
      },
      routes: [
        mount('/v1', toApp('api'))
      ]
    });

    const runtime = toWebRuntimeConfig(app);
    expect(runtime.apps.api).toMatchObject({
      runtime: 'edge',
      basePath: '/v1/'
    });
    const web = await createWebRuntime(runtime);
    await expect((await web.fetch('/v1/health')).text()).resolves.toBe('explicit');
    expect(explicitFetch).toHaveBeenCalled();
  });

  it('wraps asyncDbApp descriptors with the WebRuntime AsyncDB adapter', async () => {
    const dbConfig = {
      owner: '@async/db',
      manifest: 'db.config.mjs'
    };
    const app = defineApp({
      name: 'crm',
      apps: {
        db: asyncDbApp({
          config: dbConfig,
          basePath: '/data/',
          viewerPath: '/__data/',
          operations: {
            contract: 'public',
            registeredOnly: true
          },
          contracts: {
            public: {
              operations: ['GetUser']
            }
          }
        })
      },
      routes: [
        mount('/data', toApp('db'))
      ]
    });

    const runtime = toWebRuntimeConfig(app);
    expect(runtime.apps.db).toMatchObject({
      runtime: 'async-db',
      basePath: '/data/'
    });
    const dbApp = runtime.apps.db!.app as unknown as { asyncDb: { config: unknown; viewerPath: string; operations: Record<string, unknown> } };
    expect(dbApp.asyncDb.config).toBe(dbConfig);
    expect(dbApp.asyncDb.viewerPath).toBe('/__data/');
    expect(dbApp.asyncDb.operations).toMatchObject({
      contract: 'public',
      registeredOnly: true
    });
  });

  it('records remote apps, environment values, and contract connections', async () => {
    const endpoint = envValue({
      local: 'http://127.0.0.1:4102',
      staging: buildEnv('IDENTITY_STAGING_URL'),
      production: buildEnv('IDENTITY_PRODUCTION_URL')
    });
    const app = defineApp({
      name: 'root',
      apps: {
        identity: remoteApp({
          endpoint,
          manifest: '/.well-known/async-app.json'
        })
      },
      connections: {
        data: {
          'crm.users': envValue({
            local: 'identityLocal.contracts.public.users',
            production: 'identity.contracts.public.users'
          })
        },
        auth: {
          provider: 'identity'
        },
        api: {
          'crm.identity': 'identity.contracts.public.operations'
        },
        events: {
          'crm.customer.created': ['identity.contracts.internal.events.audit']
        }
      },
      routes: [
        mount('/identity', toApp('identity'))
      ]
    });

    const runtime = toWebRuntimeConfig(app);
    expect(app.connections.data?.['crm.users']).toMatchObject({
      type: 'env-value'
    });
    expect(runtime.apps.identity).toMatchObject({
      runtime: 'remote',
      baseUrl: 'http://127.0.0.1:4102/'
    });
    expect(resolveEnvValue(endpoint, {
      environment: 'production',
      buildEnv: {
        IDENTITY_PRODUCTION_URL: 'https://identity.acme.async.run'
      }
    })).toBe('https://identity.acme.async.run');

    const web = await createWebRuntime(runtime);
    await expect((await web.fetch('/identity/')).json()).resolves.toMatchObject({
      ok: true,
      runtime: 'remote',
      manifest: '/.well-known/async-app.json'
    });
  });

  it('validates remote endpoints and connection contract references', () => {
    expect(() => remoteApp({
      endpoint: 'not a url',
      manifest: '/.well-known/async-app.json'
    })).toThrow(/Expected URL value/);

    expect(() => defineApp({
      connections: {
        data: {
          'crm.users': 'identity.public.users'
        }
      }
    })).toThrow(/connections\.data\.crm\.users/);
  });

  it('compiles config-first tryApp routes through @async/web', async () => {
    const app = defineApp({
      name: 'crm',
      apps: {
        bff: fetchApp({
          fetch() {
            return new Response('missing', {
              status: 404
            });
          }
        }),
        api: fetchApp({
          fetch() {
            return Response.json({
              from: 'api'
            });
          }
        }),
        web: fetchApp({
          runtime: 'browser',
          basePath: '/',
          fetch() {
            return new Response('browser fallback');
          }
        })
      },
      routes: [
        mount('/api', tryApp({}, [
          toApp('bff'),
          toApp('api')
        ])),
        toApp('web')
      ]
    });

    expect(app.routes[0]).toMatchObject({
      type: 'mount',
      to: [
        {
          type: 'try-app',
          fallthroughStatus: [
            404
          ]
        }
      ]
    });

    const web = await createWebRuntime(toWebRuntimeConfig(app));
    await expect((await web.fetch('/api/users')).json()).resolves.toEqual({
      from: 'api'
    });
  });

  it('exposes WebRuntime route helpers for app configs', () => {
    expect(typeof cacheFirst).toBe('function');
    expect(typeof toOrigin).toBe('function');
    expect(typeof tryApp).toBe('function');
  });

  it('keeps db and api shortcuts as optional app-level conventions', async () => {
    const dbConfig = {
      owner: '@async/db',
      manifest: 'db.config.mjs'
    };
    const app = defineApp({
      name: 'crm',
      db: dbConfig,
      api: {
        fetch() {
          return Response.json({
            ok: true
          });
        }
      }
    });

    const runtime = toWebRuntimeConfig(app);
    expect(runtime.origin).toBe('https://crm.async.local');
    expect(Object.keys(runtime.apps)).toEqual([
      'web',
      'api',
      'db'
    ]);
    const dbApp = runtime.apps.db!.app as unknown as { asyncDb: { config: unknown } };
    expect(dbApp.asyncDb.config).toBe(dbConfig);

    const apiResponse = await runtime.apps.api!.app.fetch(
      new Request('https://crm.async.local/api/health'),
      {},
      {} as never
    );
    await expect(apiResponse.json()).resolves.toEqual({
      ok: true
    });
  });
});
