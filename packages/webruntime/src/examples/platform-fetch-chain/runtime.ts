import { createWebRuntimeApp } from '../../core/define-runtime.ts';
import { mount, toApp } from '../../core/routes.ts';
import { platformFetchChainBackendApp } from './backend.ts';
import { platformFetchChainFrontendApp } from './frontend.ts';

export const platformFetchChainWebRuntime = createWebRuntimeApp({
  origin: 'https://platform-fetch-chain.local',
  apps: {
    frontend: {
      app: platformFetchChainFrontendApp,
      basePath: '/'
    },
    backend: {
      app: platformFetchChainBackendApp,
      runtime: 'backend',
      basePath: '/api/'
    }
  },
  routes: [
    mount('/api', toApp('backend')),
    toApp('frontend')
  ]
});
