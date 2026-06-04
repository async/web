# @async/web

Developer-facing app framework for Async Web.

`defineApp()` records app topology and lowers it into `@async/web/runtime` config. Start with explicit `apps` and `routes` when the app is multiple systems wired together.

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
  apps: {
    web: browserApp({
      document: './apps/web/index.html',
      basePath: '/',
      fallback: 'spa'
    }),
    api: fetchApp({
      runtime: 'origin',
      basePath: '/api/',
      fetch: apiFetch
    })
  },
  routes: [
    mount('/api', toApp('api')),
    toApp('web')
  ]
});
```

App names are arbitrary. `browserApp()` creates a static browser `FetchApp`, `fetchApp()` preserves raw Fetch handlers, and `asyncDbApp()` mounts the AsyncDB adapter when the DB app should be explicit in `apps`. Convention shortcuts such as `api: { dir: './src/api' }` and `db: dbConfig` are still supported for projects that want the defaults.

The framework defaults live in `asyncWebDefaultConfig`, exported from `@async/web`, so app authors and contributors can see the internal baseline that `defineApp()` merges user config against.

Configs compose recursively:

```ts
import crm from '../crm/async.config';
import admin from '../admin/async.config';
import {
  defineApp,
  mount,
  toApp
} from '@async/web';

export default defineApp({
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
```

Child apps can declare local dev intent with `dev: { port, strictPort }`. Routes stay logical and never point at localhost ports directly.

Root apps can also compose remote apps by contract. `remoteApp()` records the
remote endpoint and manifest path; `envValue()` selects topology values during
build/dev orchestration, and `buildEnv()` marks values supplied by deploy
infrastructure.

```ts
import {
  buildEnv,
  defineApp,
  envValue,
  remoteApp
} from '@async/web';

export default defineApp({
  apps: {
    identity: remoteApp({
      endpoint: envValue({
        local: 'http://127.0.0.1:4102',
        staging: buildEnv('IDENTITY_STAGING_URL'),
        production: buildEnv('IDENTITY_PRODUCTION_URL')
      }),
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
  }
});
```

Use `routes` for HTTP request flow. Use `connections` for app dependencies and
contract wiring. `envValue()` is for topology values such as endpoints,
contract refs, route targets, provider hints, and deployment names; keep
secrets in a separate binding model.
