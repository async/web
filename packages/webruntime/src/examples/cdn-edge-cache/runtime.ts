import { createWebRuntimeApp } from '../../core/define-runtime.ts';
import { cacheFirst, mount, toApp } from '../../core/routes.ts';
import { cdnEdgeCacheBackendApp } from './backend.ts';
import { cdnEdgeCacheFrontendApp } from './frontend.ts';

export const cdnEdgeCacheWebRuntime = createWebRuntimeApp({
  origin: 'https://cdn-cache.local',
  apps: {
    frontend: {
      app: cdnEdgeCacheFrontendApp,
      basePath: '/'
    },
    backend: {
      app: cdnEdgeCacheBackendApp,
      basePath: '/api/'
    }
  },
  routes: [
    mount('/api', [
      cacheFirst({
        store: 'edge',
        ttl: 60,
        tags: ['api']
      }),
      toApp('backend')
    ]),
    toApp('frontend')
  ]
});
