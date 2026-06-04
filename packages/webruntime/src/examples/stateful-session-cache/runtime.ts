import { createWebRuntimeApp } from '../../core/define-runtime.ts';
import { mount, toApp } from '../../core/routes.ts';
import { statefulSessionCacheBackendApp } from './backend.ts';
import { statefulSessionCacheFrontendApp } from './frontend.ts';

export const statefulSessionCacheWebRuntime = createWebRuntimeApp({
  origin: 'https://stateful-session-cache.local',
  apps: {
    frontend: {
      app: statefulSessionCacheFrontendApp,
      basePath: '/'
    },
    backend: {
      app: statefulSessionCacheBackendApp,
      runtime: 'backend',
      basePath: '/api/'
    }
  },
  routes: [
    mount('/api', toApp('backend')),
    toApp('frontend')
  ]
});
