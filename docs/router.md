# Router

`@async/web/router` owns pure structured route specs. It does not execute requests, implement cache stores, own platform APIs, or provision providers.

Use common route helpers from `@async/web` when authoring an app:

```ts
import {
  defineApp,
  mount,
  toApp
} from '@async/web';
```

Use `@async/web/router` directly for richer route composition and inspection:

```ts
import {
  host,
  method,
  mount,
  printRouteTable,
  splitTraffic,
  toApp,
  tryApp
} from '@async/web/router';

const routes = [
  host('admin.acme.async.run', toApp('admin')),
  method('GET', '/api/health', toApp('api')),
  mount('/api', tryApp({}, [
    toApp('bff'),
    toApp('api')
  ])),
  splitTraffic([
    {
      name: 'stable',
      weight: 90,
      to: toApp('web')
    },
    {
      name: 'preview',
      weight: 10,
      to: toApp('preview')
    }
  ])
];

console.log(printRouteTable(routes));
```

Route specs use `type`, not `kind`, so they are inspectable and serializable. Helper functions use config-first options where they need options; for example `tryApp({}, [toApp('bff'), toApp('api')])` falls through on 404 by default. WebRuntime remains responsible for execution, cache behavior, platform fetch re-entry, runtime context, tracing, streaming, virtual filesystem, provider placement, and browser/service-worker simulation.

Distribution is not a route type. Author logical routes such as `mount('/api', toApp('api'))`, then express physical intent through app/runtime policy such as `runtime`, `placement`, and `region`.
