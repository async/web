import { createWebRuntimeApp } from '../../core/define-runtime.ts';
import { toApp } from '../../core/routes.ts';
import { streamingApp } from './manifest.ts';

export const streamingAppWebRuntime = createWebRuntimeApp({
  origin: 'https://streaming-app.local',
  files: streamingApp.files,
  apps: {
    streaming: {
      app: streamingApp.app,
      basePath: '/'
    }
  },
  routes: [
    toApp('streaming')
  ]
});
