# Simple Fullstack

Frontend plus API app using `@async/web/runtime` directly:

```ts
import {
  defineRuntime,
  mount,
  toApp
} from '@async/web/runtime';

export default defineRuntime({
  origin: 'https://fullstack.local',
  apps: {
    frontend: {
      basePath: '/',
      fetch: frontendFetch
    },
    api: {
      runtime: 'origin',
      basePath: '/api/',
      fetch: apiFetch
    }
  },
  routes: [
    mount('/api', toApp('api')),
    toApp('frontend')
  ]
});
```
