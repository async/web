# AsyncDB Integration

`@async/db` is an optional first-party integration for `@async/web`. Apps that use AsyncDB install `@async/db` for resources, schemas, operations, generated types, manifests, and store contracts. `@async/web/runtime` includes the AsyncDB adapter placeholder:

```ts
import { createAsyncDbApp } from '@async/web/runtime/async-db';
import dbConfig from './db.config.js';

const db = createAsyncDbApp({
  config: dbConfig,
  runtime: 'async-db',
  basePath: '/db/',
  viewerPath: '/__db/'
});
```

`@async/web` exposes `asyncDbApp()` for centralized app configs, so most app authors can keep the import surface on `@async/web` while still using WebRuntime placement:

```ts
import {
  asyncDbApp,
  defineApp,
  mount,
  toApp
} from '@async/web';
import dbConfig from './db.config.js';

export default defineApp({
  apps: {
    db: asyncDbApp({
      config: dbConfig,
      basePath: '/db/',
      viewerPath: '/__db/'
    })
  },
  routes: [
    mount('/db', toApp('db'))
  ]
});
```

The adapter owns route placement and runtime context only. It does not reimplement AsyncDB.

Responsibilities remain split:

- `@async/db`: resources, schemas, operations, generated types, manifests, and store contracts.
- `@async/web/runtime`: route placement, caching, runtime context, and region/read/write policy.
- `@async/web`: centralized app config, good defaults, and optional shortcuts that register AsyncDB with the runtime graph.

`@async/web` can mount this adapter automatically when an AsyncDB config is passed as `db`, or an app can mount `asyncDbApp()` explicitly in `apps.db`.

## Contracts And Connections

AsyncDB owns contracts. A contract is the API boundary a consumer can see and
call: resources, readable fields, callable operations, and allowed writes.
Async Web references those contracts from `connections`.

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
        production: buildEnv('IDENTITY_URL')
      }),
      manifest: '/.well-known/async-app.json'
    })
  },

  connections: {
    data: {
      'crm.users': 'identity.contracts.public.users',
      'admin.users': 'identity.contracts.admin.users'
    },
    api: {
      'crm.identity': 'identity.contracts.public.operations'
    }
  }
});
```

`routes` still describe HTTP flow. `connections` describe dependency wiring.
Runtime adapters may compile `connections.data` into lower-level bindings, but
DB schema and operation policy stay inside `@async/db`.
