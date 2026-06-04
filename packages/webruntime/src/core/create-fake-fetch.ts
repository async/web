import type { WebRuntime } from './types.ts';

export function createFakeFetch(web: WebRuntime): typeof fetch {
  return web.platform.createFetch();
}
