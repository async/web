export {
  cacheFirst,
  cacheOnly,
  networkFirst,
  networkOnly,
  staleWhileRevalidate
} from '../core/routes.ts';

export {
  createWebRuntimeEdgeCache
} from '../core/create-edge-cache.ts';

export type {
  EdgeCache,
  EdgeCacheConfig,
  EdgeCacheEntryInfo,
  EdgeCacheMatchOptions,
  EdgeCachePutOptions,
  WebRuntimeCache,
  WebRuntimeCacheQueryOptions,
  WebRuntimeCacheStorage
} from '../core/types.ts';

