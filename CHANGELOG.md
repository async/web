# Changelog

## [0.1.0](https://github.com/async-framework/async-miniweb/releases/tag/v0.1.0) - 2026-05-28

Initial public release of MiniWeb as `@async/miniweb`.

### Features

- Added the MiniWeb `Request -> Response` simulator with fake frontend, service worker, network, edge/CDN, backend, tracing, delay, streaming, and virtual filesystem support.
- Added promise-based route middleware with mounted apps, mock/origin routes, cache helpers, redirects, rewrites, static file serving, and backend app dispatch.
- Added scoped platform APIs for per-runtime `fetch`, storage, cookies, cache storage, timers, crypto, encoding, messaging, navigator state, and fake locations.
- Added same-realm and iframe runtime configuration for registered frontend and backend apps.
- Added MiniWeb-to-MiniWeb routing and streaming through the virtual network.
- Added browser shell examples for full-stack demos, service-worker-style cache, edge cache, streaming, multi-app routing, request bodies, platform fetch chains, and stateful session/cache behavior.
- Added the `@async/miniweb/platform` authoring facade and `@async/miniweb/vite` plugin for dev-time MiniWeb APIs and build-time native globals.

### Tests

- Added coverage for memory filesystem, fake location/history/navigation, service worker routing, pipeline tracing, delay, edge cache/transforms, request bodies, streaming responses, MiniWeb network streaming, platform state, iframe runtime config, browser shell routing, and Vite platform import behavior.

### Documentation

- Added README and docs for getting started, concepts, examples, routes/cache, platform/runtimes, browser shell usage, and Vite compile-away behavior.
