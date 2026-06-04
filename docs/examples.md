# Examples

The root `examples/` directory documents the public Async Web example set. The runtime browser shell still includes reusable fixtures under `packages/webruntime/src/examples/` until those are promoted into standalone example packages.

Run the browser shell:

```sh
pnpm --dir packages/webruntime dev
```

Open `http://localhost:5173/`.

## Example Directory

| Example | Focus |
| --- | --- |
| `hello-app` | minimal app defaults |
| `simple-fullstack` | frontend plus backend route graph |
| `service-worker-cache` | platform cache storage as a service-worker-style cache |
| `cdn-edge-cache` | shared edge cache with tags and trace entries |
| `edge-middleware` | redirect, rewrite, and HTML transform middleware |
| `multi-app-network` | host-based routing to another app |
| `async-db-app` | AsyncDB route adapter placement |
| `runtime-routing` | explicit WebRuntime route control |

The browser shell additionally keeps legacy streaming, request-body, platform-fetch-chain, and stateful-session-cache fixtures for coverage.

## Tests

Runtime example coverage lives in:

- `packages/webruntime/tests/example-apps.test.ts`
- `packages/webruntime/tests/example-route-coverage.test.ts`
- `packages/webruntime/tests/browser-web-runtime.test.ts`
