# Vite Compile-Away

App code can import platform APIs from WebRuntime during development:

```ts
import {
  Request,
  Response,
  fetch,
  localStorage
} from '@async/web/runtime/platform';
```

Use the Vite plugin:

```ts
import { webRuntime } from '@async/web/runtime/vite';

export default {
  plugins: [
    webRuntime()
  ]
};
```

Default behavior:

- `vite dev` resolves platform imports to scoped WebRuntime APIs.
- `vite build` resolves platform imports to native `globalThis` APIs.

Use `webRuntime({ target: 'web-runtime' })` for static demos that should keep the route graph after build, or `webRuntime({ target: 'native' })` to use native APIs in both dev and build.
