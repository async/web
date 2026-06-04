# Multi-App Network

Register multiple apps and route by path or domain:

```ts
routes: [
  domain('api.local', toApp('api')),
  mount('/admin', toApp('admin')),
  toApp('frontend')
]
```
