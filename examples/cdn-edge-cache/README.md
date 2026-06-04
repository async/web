# CDN Edge Cache

Use the shared edge cache store for CDN-style behavior:

```ts
routes: [
  mount('/assets', [
    cacheFirst({
      store: 'edge',
      ttl: 300,
      tags: ['assets']
    }),
    toApp('assets')
  ]),
  toApp('frontend')
]
```
