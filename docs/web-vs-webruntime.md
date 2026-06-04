# Web, Router, and WebRuntime

Use `@async/web` when:

- you are building an app
- you want AsyncDB, auth, settings, flags, and deploy defaults
- you prefer conventions over explicit route graph setup
- you want recursive app composition and local dev orchestration
- you want to start simple and drop down later

Use `@async/web/router` when:

- you need richer structured route specs
- you want route validation, inspection, or route table printing
- you are composing host, method, traffic split, or other advanced logical routes
- you do not need request execution, platform APIs, cache stores, or provider simulation

Use `@async/web/runtime` when:

- you are executing routing
- you are simulating CDN, WAF, edge, origin, browser, or service-worker boundaries
- you need cache placement control
- you are compiling app code to native platform APIs
- you are building provider adapters
- you are ejecting from `@async/web` defaults

`@async/web` lowers structured route specs into WebRuntime config. `@async/web/router` owns pure route shape. WebRuntime remains the durable Request -> Response execution contract.
