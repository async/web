import { createWebRuntimeApp } from '../../core/define-runtime.ts';
import { domain, toApp } from '../../core/routes.ts';
import { multiAppNetworkApiApp } from './api.ts';
import { multiAppNetworkFrontendApp } from './frontend.ts';

export const multiAppNetworkWebRuntime = createWebRuntimeApp({
  origin: 'https://web.local',
  apps: {
    frontend: {
      app: multiAppNetworkFrontendApp,
      baseUrl: 'https://web.local/'
    },
    api: {
      app: multiAppNetworkApiApp,
      baseUrl: 'https://api.local/'
    }
  },
  routes: [
    domain('api.local', toApp('api')),
    toApp('frontend')
  ]
});
