# Edge Middleware

Model edge middleware with route helpers:

```ts
routes: [
  redirect('/old', 308),
  mount('/edge', [
    middleware((request) => request.headers.has('x-preview'), toApp('preview')),
    toApp('edge')
  ]),
  toApp('frontend')
]
```
