# Mini Cloudflare

Mini Cloudflare is a local provider shim for exercising Cloudflare-shaped
deployments through `@async/web/runtime`.

It is not a Cloudflare provisioner, not a Miniflare replacement, and it does not
call the Cloudflare API. It gives product flows a deterministic local target
that looks enough like Workers to validate deployment wiring before a real
adapter exists.

Use it when you want to test:

- a generated preview URL for a deployment
- a Worker-style `fetch(request, env, ctx)` handler
- static assets through `env.ASSETS.fetch(request)`
- KV, R2, and D1-like bindings with in-memory state
- `ctx.waitUntil()` background work
- `caches.default` behavior backed by WebRuntime edge cache
- an actual `127.0.0.1` URL for browser or Tailscale preview testing

## Virtual Deployment

```ts
import {
  createMiniCloudflareDeployment
} from '@async/web/runtime/providers';

const deployment = await createMiniCloudflareDeployment({
  id: 'deployment_123',
  assets: {
    '/index.html': '<!doctype html><h1>Hello from preview</h1>'
  },
  kv: {
    KV: {
      feature: '{"enabled":true}'
    }
  },
  r2: {
    R2: {}
  },
  d1: {
    DB: {
      'select count(*) as count from deployments': {
        results: [{ count: 1 }]
      }
    }
  },
  worker: {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);

      if (url.pathname === '/api/status') {
        const feature = await env.KV.get('feature', 'json');
        const row = await env.DB
          .prepare('select count(*) as count from deployments')
          .first();

        ctx.waitUntil(env.R2.put('events/api-status.json', JSON.stringify({
          pathname: url.pathname
        })));

        return Response.json({
          feature,
          deploymentCount: row?.count
        });
      }

      return env.ASSETS.fetch(request);
    }
  }
});

console.log(deployment.previewUrl);
// https://deployment-123.preview.async.local/

const response = await deployment.fetch('/');
console.log(await response.text());
```

## Local URL

Use the Node helper when a human needs a real browser URL:

```ts
import {
  createMiniCloudflareDeployment
} from '@async/web/runtime/providers';
import {
  serveMiniCloudflareDeployment
} from '@async/web/runtime/node/mini-cloudflare';

const deployment = await createMiniCloudflareDeployment({
  id: 'deployment_123',
  assets: {
    '/index.html': '<!doctype html><h1>Hello from localhost</h1>'
  }
});

const server = await serveMiniCloudflareDeployment(deployment, {
  basePath: '/preview/deployment-123'
});

console.log(server.url);
// http://127.0.0.1:49152/preview/deployment-123/
```

That URL can then be exposed with Tailscale Serve or another local sharing tool.

## Async Webapps Fit

The intended Async Webapps flow is:

```text
build artifact
-> @async/db deployment record
-> mini Cloudflare deployment
-> WebRuntime edge execution
-> local preview URL
-> optional Tailscale namespace
```

The product dashboard should own builds, projects, releases, domains, and audit
events. Mini Cloudflare should stay a local provider adapter that lets the
dashboard prove the deployment contract before switching the same shape to real
Cloudflare Workers, Pages, R2, KV, D1, or Hyperdrive-backed resources.
