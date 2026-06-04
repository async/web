# @async/web/router

Pure structured route specs and composition helpers for Async Web.

This directory is the workspace-local implementation package. Public consumers import it through `@async/web/router`.

`@async/web/router` does not execute requests, implement cache stores, own platform APIs, or provision providers. It only describes route intent in inspectable objects that use `type`.

```ts
import {
  host,
  method,
  mount,
  splitTraffic,
  toApp,
  tryApp
} from '@async/web/router';

export const routes = [
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
```

`@async/web` re-exports common helpers such as `mount()` and `toApp()` for the simple path. Import richer routing helpers directly from `@async/web/router`.
