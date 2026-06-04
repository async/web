# @async/web/runtime

Lower-level Request -> Response runtime for Async Web.

This directory is the workspace-local implementation package. Public consumers import it through `@async/web/runtime`.

It owns the runtime graph, route middleware, scoped platform APIs, cache stores, tracing, virtual filesystem, fake browser/runtime helpers, provider extension points, and Vite compile-away plugin.

```ts
import {
  createWebRuntime,
  defineRuntime,
  mount,
  toApp
} from '@async/web/runtime';
```
