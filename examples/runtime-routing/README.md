# Runtime Routing

Use `@async/web/runtime` when route placement is the core concern:

```ts
routes: [
  mount('/db/users', toApp('postgresUsers')),
  mount('/db/feature-flags', toApp('edgeFeatureFlags')),
  mount('/api', toApp('api')),
  toApp('frontend')
]
```
