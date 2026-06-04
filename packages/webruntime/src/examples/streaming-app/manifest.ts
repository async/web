import { streamingServer } from './server.ts';

export const streamingApp = {
  id: 'streaming-app',
  name: 'Streaming App',
  app: streamingServer,
  files: {
    '/server.js': `
      export async function fetch() {
        return new Response('streaming demo');
      }
    `
  }
};
