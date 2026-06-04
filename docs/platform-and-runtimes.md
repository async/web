# Platform and Runtimes

WebRuntime owns scoped platform APIs for every app/runtime environment. The important rule is:

```ts
platform.fetch('/api/message')
```

enters the WebRuntime route graph instead of bypassing it.

Runtime configs can model:

- browser/frontend execution
- service-worker behavior
- edge middleware
- origin/backend apps
- AsyncDB route placement
- same-realm or iframe isolation in local demos

Placement is app/runtime policy, not a route type:

```ts
apps: {
  web: {
    runtime: 'browser'
  },
  edge: {
    runtime: 'edge',
    placement: 'global'
  },
  api: {
    runtime: 'origin',
    region: 'us-east'
  },
  db: {
    runtime: 'async-db',
    region: 'same-as-api'
  }
}
```

Provider placement is intentionally an extension point. The current package defines provider hooks for future `cloudflare`, `imperva`, `fly`, `node`, `static`, and `async-cloud` targets without provisioning real infrastructure.
