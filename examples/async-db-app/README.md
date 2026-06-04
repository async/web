# AsyncDB App

Mount AsyncDB through WebRuntime without moving AsyncDB data contracts into the runtime:

```ts
import { createAsyncDbApp } from '@async/web/runtime/async-db';

const db = createAsyncDbApp({
  config: dbConfig,
  runtime: 'async-db',
  basePath: '/db/',
  viewerPath: '/__db/'
});
```
