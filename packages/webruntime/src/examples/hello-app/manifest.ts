import { helloServer } from './server.ts';

export const helloApp = {
  id: 'hello-app',
  name: 'Hello App',
  app: helloServer,
  files: {
    '/package.json': JSON.stringify({
      scripts: {
        dev: 'node server.js'
      }
    }, null, 2),
    '/server.js': `
      export async function fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === '/') {
          return new Response('<h1>Home</h1>');
        }
        return new Response('Not found', {
          status: 404
        });
      }
    `
  }
};
