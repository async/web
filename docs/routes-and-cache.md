# Routes and Cache

`@async/web/router` routes are structured config objects. They use `type`, not `kind`, and are safe to inspect, validate, print, or compile.

```ts
import {
  cacheFirst,
  host,
  method,
  mount,
  splitTraffic,
  toApp,
  toOrigin,
  tryApp
} from '@async/web/router';
```

Common route helpers:

- `mount(prefix, route)` strips a logical path prefix and delegates to child route specs.
- `toApp(name)` dispatches to a registered app.
- `toOrigin(baseUrl)` proxies to an upstream origin.
- `toFiles()` serves virtual filesystem entries.
- `redirect()` changes request flow.
- `cacheFirst()`, `networkFirst()`, `staleWhileRevalidate()`, `cacheOnly()`, and `networkOnly()` model cache policy.
- `tryApp(options, candidates)` tries candidates in order and falls through on `fallthroughStatus`, which defaults to `[404]`.
- `host()`, `method()`, and `splitTraffic()` live canonically in `@async/web/router` for richer route composition.

Example:

```ts
routes: [
  mount('/flags',
    cacheFirst({
      store: 'edge',
      ttl: 30,
      next: toApp('featureFlags')
    })
  ),
  mount('/db/users', toApp('postgresUsers')),
  mount('/db/feature-flags', toApp('edgeFeatureFlags')),
  mount('/api', tryApp({}, [
    toApp('bff'),
    toApp('api')
  ])),
  toApp('web')
]
```

Cache stores remain runtime-owned. `@async/web/router` describes the cache intent, while `@async/web/runtime` executes cache behavior. Provider packages can later map those stores to edge, service-worker, static, or origin infrastructure.
