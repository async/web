# Async Web

Async Web is the workspace for the Async web ecosystem.

- `@async/web` is the developer-facing app framework. Start here when you are building an app with app conventions, AsyncDB shortcuts, deployment defaults, and a simple path to production.
- `@async/web/router` is the pure structured routing package. Use it for richer inspectable route specs, route composition, validation, and route table printing.
- `@async/web/runtime` is the lower-level Request -> Response runtime. Drop down here when you need explicit routing, runtime placement, cache behavior, platform simulation, provider hooks, or compile-away infrastructure control.

The original runtime direction is preserved: apps, routes, scoped platform APIs, cache stores, middleware, virtual browser behavior, and Vite compile-away behavior all remain centered on `platform.fetch()` entering a controlled Request -> Response route graph.

## Public Imports

| Import | Role |
| --- | --- |
| `@async/web` | Friendly app authoring API that lowers conventions into WebRuntime config. |
| `@async/web/router` | Pure `type`-tagged route specs and composition helpers. |
| `@async/web/runtime` | Runtime engine, route graph, platform APIs, cache policies, tracing, provider extension points, and Vite compile-away plugin. |
| `@async/db` | Data contracts, resources, schemas, operations, generated types, and store contracts. |

## Quick Start

```ts
import {
  asyncDbApp,
  browserApp,
  defineApp,
  fetchApp,
  mount,
  toApp,
  tryApp
} from '@async/web';
import dbConfig from './db.config.mjs';

export default defineApp({
  origin: 'https://crm.acme.async.run',
  apps: {
    web: browserApp({
      document: './apps/web/index.html',
      basePath: '/',
      fallback: 'spa'
    }),
    bff: fetchApp({
      runtime: 'edge',
      placement: 'global',
      fetch: edgeFetch
    }),
    api: fetchApp({
      runtime: 'origin',
      basePath: '/api/',
      region: 'us-east',
      fetch: apiFetch
    }),
    db: asyncDbApp({
      config: dbConfig,
      basePath: '/db/',
      region: 'same-as-api',
      viewerPath: '/__db/'
    })
  },
  routes: [
    mount('/db', toApp('db')),
    mount('/api', tryApp({}, [
      toApp('bff'),
      toApp('api')
    ])),
    toApp('web')
  ]
});
```

`browserApp()` creates a static browser `FetchApp` from a document and assets. `fetchApp()` keeps raw Fetch handlers as the lower-level escape hatch, and `asyncDbApp()` mounts the WebRuntime adapter while `@async/db` remains the data contract owner. `@async/web` also keeps app-level shortcuts such as `api: { dir: './src/api' }` and `db: dbConfig` for convention-based projects. The explicit `apps` and `routes` form is the source of truth when you need to see how browser, edge, backend, database, or other systems are wired.

For richer routing, import the advanced structured helpers from `@async/web/router`:

```ts
import {
  host,
  method,
  splitTraffic
} from '@async/web/router';
```

Distribution is not a route type. Apps and route steps describe logical topology; placement and region policy live on app/runtime config and can later compile to provider infrastructure.

Use `@async/web/runtime` directly when you want the runtime graph:

```ts
import {
  defineRuntime,
  mount,
  toApp
} from '@async/web/runtime';

export default defineRuntime({
  origin: 'https://crm.acme.async.run',
  apps: {
    web: {
      runtime: 'browser',
      basePath: '/',
      fetch: webFetch
    },
    api: {
      runtime: 'origin',
      basePath: '/api/',
      fetch: apiFetch
    },
    db: {
      runtime: 'async-db',
      basePath: '/db/',
      fetch: asyncDbFetch
    }
  },
  routes: [
    mount('/db', toApp('db')),
    mount('/api', toApp('api')),
    toApp('web')
  ]
});
```

## Workspace

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## Docs

- [Getting Started](docs/getting-started.md)
- [Concepts](docs/concepts.md)
- [Web vs WebRuntime](docs/web-vs-webruntime.md)
- [Router](docs/router.md)
- [Routes and Cache](docs/routes-and-cache.md)
- [Platform and Runtimes](docs/platform-and-runtimes.md)
- [AsyncDB Integration](docs/async-db-integration.md)
- [Mini Cloudflare](docs/mini-cloudflare.md)
- [Vite Compile-Away](docs/vite-compile-away.md)
- [Migration Guide](docs/migration-from-miniweb.md)

## Non-Goals

This pass does not implement a hosted PaaS, billing, real provider provisioning, or a full Imperva/Fly/Cloudflare deployment adapter. Provider packages are extension points until the deployment layer is ready.
