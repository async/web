# Changelog

## [0.2.0](https://github.com/async/web/releases/tag/v0.2.0) - 2026-06-14

### Features

- Add generated `@async/pipeline` release, preview, snapshot, GitHub Pages, and API surface workflows for the Async org release standard.
- Add API surface ledger artifacts and pnpm-first release documentation for the publishable `@async/web` package.

### Changed

- Standardize docs and package task examples on pnpm and `pnpm run <pipeline-name>`.
- Replace the standalone release workflow with the generated `async-pipeline.yml`.

## [0.1.1](https://github.com/async-framework/async-web/releases/tag/v0.1.1) - 2026-06-08

### Features

- Added a Mini Cloudflare provider shim for local Worker-shaped deployments with ASSETS, KV, R2, D1, `ctx.waitUntil()`, `caches.default`, virtual preview URLs, and WebRuntime-backed execution.
- Added a Node preview server helper for serving Mini Cloudflare deployments on real `127.0.0.1` URLs for browser and Tailscale iteration.

### Documentation

- Added a Mini Cloudflare guide that maps the local provider shim to Async Webapps build, deployment, preview, and future Cloudflare adapter flows.

## [0.1.0](https://github.com/async-framework/async-web/releases/tag/v0.1.0) - 2026-05-28

Initial public release of Async Web as `@async/web`.

### Features

- Added the WebRuntime `Request -> Response` simulator with fake frontend, service worker, network, edge/CDN, backend, tracing, delay, streaming, and virtual filesystem support.
- Added promise-based route middleware with mounted apps, mock/origin routes, cache helpers, redirects, rewrites, static file serving, and backend app dispatch.
- Added scoped platform APIs for per-runtime `fetch`, storage, cookies, cache storage, timers, crypto, encoding, messaging, navigator state, and fake locations.
- Added same-realm and iframe runtime configuration for registered frontend and backend apps.
- Added WebRuntime-to-WebRuntime routing and streaming through the virtual network.
- Added browser shell examples for full-stack demos, service-worker-style cache, edge cache, streaming, multi-app routing, request bodies, platform fetch chains, and stateful session/cache behavior.
- Added the `@async/web/runtime/platform` authoring facade and `@async/web/runtime/vite` plugin for dev-time WebRuntime APIs and build-time native globals.

### Tests

- Added coverage for memory filesystem, fake location/history/navigation, service worker routing, pipeline tracing, delay, edge cache/transforms, request bodies, streaming responses, WebRuntime network streaming, platform state, iframe runtime config, browser shell routing, and Vite platform import behavior.

### Documentation

- Added README and docs for getting started, concepts, examples, routes/cache, platform/runtimes, browser shell usage, and Vite compile-away behavior.
