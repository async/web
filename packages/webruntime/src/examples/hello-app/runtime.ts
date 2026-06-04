import { createWebRuntimeApp } from '../../core/define-runtime.ts';
import { toApp } from '../../core/routes.ts';
import { helloApp } from './manifest.ts';

export const helloAppWebRuntime = createWebRuntimeApp({
  origin: 'https://hello-app.local',
  files: helloApp.files,
  apps: {
    hello: {
      app: helloApp.app,
      basePath: '/'
    }
  },
  routes: [
    toApp('hello')
  ]
});
