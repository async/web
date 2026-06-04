import { createWebRuntimeApp } from '../../core/define-runtime.ts';
import { mount, toApp } from '../../core/routes.ts';
import { simpleBackendApp } from './backend.ts';
import { simpleFrontendApp } from './frontend.ts';

export const simpleFullstackWebRuntime = createWebRuntimeApp({
  origin: 'https://webruntime.local',
  apps: {
    frontend: {
      app: simpleFrontendApp,
      basePath: '/'
    },
    backend: {
      app: simpleBackendApp,
      basePath: '/api/'
    }
  },
  routes: [
    mount('/api', toApp('backend')),
    toApp('frontend')
  ]
});
