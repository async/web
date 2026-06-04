# Service Worker Cache

Use WebRuntime cache middleware to model a service-worker cache boundary:

```ts
routes: [
  mount('/api', [
    cacheFirst({
      store: 'service-worker',
      ttl: 30
    }),
    toApp('api')
  ]),
  toApp('frontend')
]
```
