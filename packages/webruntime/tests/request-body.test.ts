import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWebRuntime } from '../src/core/create-web-runtime.ts';
import { createWebRuntimeNetwork } from '../src/core/create-web-runtime-network.ts';

describe('request body preservation', () => {
  let origin = '';
  let server: Server;

  beforeAll(async () => {
    server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      request.on('end', () => {
        response.writeHead(200, {
          'content-type': 'application/json'
        });
        response.end(JSON.stringify({
          method: request.method,
          url: request.url,
          body: Buffer.concat(chunks).toString('utf8'),
          contentType: request.headers['content-type']
        }));
      });
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

  it('preserves POST bodies through fake service worker and edge rewrite', async () => {
    const web = await createWebRuntime({
      origin: 'http://localhost:3000',
      app: {
        async fetch(request) {
          return Response.json({
            pathname: new URL(request.url).pathname,
            body: await request.text(),
            contentType: request.headers.get('content-type')
          });
        }
      },
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'fake'
        },
        edge: {
          kind: 'fake',
          worker: {
            fetch(request, _env, context) {
              const url = new URL(request.url);
              url.pathname = '/rewritten';
              return context.next(new Request(url, request));
            }
          }
        },
        backend: {
          kind: 'fetch-app'
        }
      }
    });

    const response = await web.fetch('/submit', {
      method: 'POST',
      headers: {
        'content-type': 'text/plain'
      },
      body: 'hello=webRuntime'
    });
    const data = await response.json();

    expect(data).toEqual({
      pathname: '/rewritten',
      body: 'hello=webRuntime',
      contentType: 'text/plain'
    });
  });

  it('preserves POST bodies through backend HTTP proxy', async () => {
    const web = await createWebRuntime({
      origin: 'http://localhost:3000',
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        backend: {
          kind: 'http-proxy',
          targetOrigin: origin
        }
      }
    });

    const response = await web.fetch('/api/echo?x=1', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: 'a=1&b=2'
    });
    const data = await response.json();

    expect(data).toEqual({
      method: 'POST',
      url: '/api/echo?x=1',
      body: 'a=1&b=2',
      contentType: 'application/x-www-form-urlencoded'
    });
  });

  it('preserves POST bodies through WebRuntime-to-WebRuntime network', async () => {
    const network = createWebRuntimeNetwork();
    const apiWeb = await createWebRuntime({
      origin: 'https://api.local',
      app: {
        async fetch(request) {
          return Response.json({
            pathname: new URL(request.url).pathname,
            body: await request.text()
          });
        }
      },
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        backend: {
          kind: 'fetch-app'
        }
      }
    });
    const web = await createWebRuntime({
      origin: 'https://web.local',
      network,
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        network: {
          kind: 'web-runtime-network'
        },
        backend: {
          kind: 'mock',
          routes: {}
        }
      }
    });
    network.register('https://api.local', apiWeb);
    network.register('https://web.local', web);

    const response = await web.fetch('https://api.local/events', {
      method: 'POST',
      body: 'stream me'
    });
    const data = await response.json();

    expect(data).toEqual({
      pathname: '/events',
      body: 'stream me'
    });
  });
});
