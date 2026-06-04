# Concepts

Async Web keeps the original runtime model: standard `Request` objects enter a route graph and standard `Response` objects come back.

## Apps

An app is a browser-safe `FetchApp`:

```ts
const api = {
  fetch(request, env, context) {
    return Response.json({
      pathname: new URL(request.url).pathname
    });
  }
};
```

Apps can represent browser documents/assets, origin handlers, AsyncDB adapters, service-worker behavior, edge middleware, or local test fixtures. In `@async/web`, builders such as `browserApp()`, `fetchApp()`, and `asyncDbApp()` all normalize to the same internal `FetchApp` shape.

## Routes

Routes are structured specs in `@async/web/router`. They decide whether a request is mounted, redirected, cached, proxied to an origin, served from files, or sent to an app. `@async/web` lowers those specs into WebRuntime middleware when it builds the executable runtime config.

```ts
routes: [
  mount('/db', toApp('db')),
  mount('/api', toApp('api')),
  toApp('web')
]
```

## Platform

Each runtime environment owns scoped platform APIs. `platform.fetch()` resolves relative URLs from the current app location and re-enters the same route graph.

## Packages

Use `@async/web` for app defaults and deployment-oriented configuration. Use `@async/web/router` for structured route inspection and composition. Use `@async/web/runtime` when runtime execution, cache behavior, platform context, or provider placement needs to be explicit.
