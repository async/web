import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWebRuntime } from '../src/core/create-web-runtime.ts';

describe('http backend proxy', () => {
  let origin = '';
  let server: Server;

  beforeAll(async () => {
    server = createServer((request, response) => {
      if (request.url === '/api/real') {
        response.writeHead(200, {
          'content-type': 'application/json'
        });
        response.end(JSON.stringify({
          source: 'real-http-server'
        }));
        return;
      }

      response.writeHead(404);
      response.end('Not found');
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected server address');
    }
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  it('proxies backend requests to real HTTP server', async () => {
    const web = await createWebRuntime({
      origin: 'http://localhost:3000',
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        network: {
          kind: 'blocked'
        },
        edge: {
          kind: 'bypass'
        },
        backend: {
          kind: 'http-proxy',
          targetOrigin: origin
        }
      }
    });

    const response = await web.fetch('/api/real');
    const data = await response.json();

    expect(data.source).toBe('real-http-server');
  });

  it('proxies edge requests to real HTTP server', async () => {
    const web = await createWebRuntime({
      origin: 'http://localhost:3000',
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        network: {
          kind: 'blocked'
        },
        edge: {
          kind: 'http-proxy',
          targetOrigin: origin
        },
        backend: {
          kind: 'mock',
          routes: {}
        }
      }
    });

    const response = await web.fetch('/api/real');
    const data = await response.json();

    expect(data.source).toBe('real-http-server');
  });
});
