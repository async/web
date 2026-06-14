# Getting Started

Start with `@async/web` when you are building an application and want defaults. Use explicit `apps` and `routes` when the app is multiple systems wired together.

```sh
pnpm add @async/web
```

```ts
import {
  browserApp,
  defineApp,
  fetchApp,
  mount,
  toApp
} from '@async/web';

export default defineApp({
  origin: 'https://crm.acme.async.run',
  dev: {
    port: 4101,
    strictPort: false
  },
  apps: {
    web: browserApp({
      document: './apps/web/index.html',
      basePath: '/',
      fallback: 'spa'
    }),
    api: fetchApp({
      runtime: 'origin',
      basePath: '/api/',
      region: 'us-east',
      fetch: apiFetch
    })
  },
  routes: [
    mount('/api', toApp('api')),
    toApp('web')
  ]
});
```

`@async/web` lowers app-level topology into a WebRuntime config. It also keeps convention shortcuts for projects that prefer defaults:

- `browserApp({ document: './index.html' })` creates a static browser `FetchApp`; `fallback: 'spa'` returns the document for browser navigation paths.
- `fetchApp({ runtime, fetch })` keeps explicit Fetch handlers for Hono, Remix-style handlers, raw Fetch apps, or custom static serving.
- `asyncDbApp({ config: dbConfig })` mounts the AsyncDB adapter placeholder when the app wants explicit DB placement in `apps`.
- `db: dbConfig` mounts the AsyncDB adapter placeholder when `@async/db` is installed by the app.
- `api: { dir: './src/api' }` records the API directory for the future CLI/build pipeline.
- `routes: { dir: './src/routes' }` records file-route conventions while explicit route arrays remain available.

The defaults are intentionally visible in code as `asyncWebDefaultConfig`. `defineApp()` uses that object as the internal baseline, then layers user-defined apps, routes, and shortcuts over it.

Configs compose recursively, so monorepos and many-repo systems can expose root wiring without pointing routes at ports:

```ts
import crm from '../crm/async.config';
import admin from '../admin/async.config';
import {
  defineApp,
  mount,
  resolveDevPorts,
  toApp
} from '@async/web';

const app = defineApp({
  name: 'root',
  apps: {
    crm,
    admin
  },
  routes: [
    mount('/crm', toApp('crm')),
    mount('/admin', toApp('admin'))
  ]
});

const devPorts = resolveDevPorts(app, {
  occupiedPorts: [
    4101
  ]
});
```

`dev.port` is a preferred port. When `strictPort` is false, the dev system can scan upward if the preferred port is taken. Routes stay logical: `toApp('crm')` resolves to the actual started or discovered endpoint.

Use `@async/web/runtime` directly for the explicit graph:

```ts
import {
  createWebRuntime,
  defineRuntime,
  mount,
  toApp
} from '@async/web/runtime';

const config = defineRuntime({
  origin: 'https://crm.local',
  apps: {
    web: {
      basePath: '/',
      fetch: webFetch
    },
    api: {
      runtime: 'origin',
      basePath: '/api/',
      fetch: apiFetch
    }
  },
  routes: [
    mount('/api', toApp('api')),
    toApp('web')
  ]
});

const runtime = await createWebRuntime(config);
const response = await runtime.fetch('/api/health');
```

Use the migration guide when moving existing projects to the new package split.
