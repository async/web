import { createWebRuntimeApp } from '../../core/define-runtime.ts';
import { cacheFirst, mount, toApp } from '../../core/routes.ts';
import { serviceWorkerCacheBackendApp } from './backend.ts';
import { serviceWorkerCacheFrontendApp } from './frontend.ts';

export const serviceWorkerCacheWebRuntime = createWebRuntimeApp({
  origin: 'https://sw-cache.local',
  apps: {
    frontend: {
      app: serviceWorkerCacheFrontendApp,
      basePath: '/'
    },
    backend: {
      app: serviceWorkerCacheBackendApp,
      basePath: '/api/'
    }
  },
  routes: [
    mount('/api', [
      cacheFirst({
        store: 'service-worker'
      }),
      toApp('backend')
    ]),
    toApp('frontend')
  ]
});
