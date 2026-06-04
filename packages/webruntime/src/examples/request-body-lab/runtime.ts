import { createWebRuntimeApp } from '../../core/define-runtime.ts';
import { mount, toApp } from '../../core/routes.ts';
import { requestBodyLabBackendApp } from './backend.ts';
import { requestBodyLabFrontendApp } from './frontend.ts';

export const requestBodyLabWebRuntime = createWebRuntimeApp({
  origin: 'https://request-body-lab.local',
  apps: {
    frontend: {
      app: requestBodyLabFrontendApp,
      basePath: '/'
    },
    backend: {
      app: requestBodyLabBackendApp,
      runtime: 'backend',
      basePath: '/api/'
    }
  },
  routes: [
    mount('/api', toApp('backend')),
    toApp('frontend')
  ]
});
