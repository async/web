import { describe, expect, it } from 'vitest';
import { createWebRuntime } from '../src/core/create-web-runtime.ts';
import { createStaticAssetEdgeWorker } from '../src/core/create-static-asset-edge-worker.ts';
import type { EdgeWorker } from '../src/core/types.ts';

describe('edge transforms', () => {
  it('transforms HTML responses', async () => {
    const worker: EdgeWorker = {
      async fetch(request, _env, context) {
        const response = await context.next(request);
        const html = await response.text();
        return new Response(html.replace('</head>', '<meta name="edge" content="fake"></head>'), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      }
    };
    const web = await createWebRuntime({
      origin: 'http://localhost:3000',
      app: {
        fetch() {
          return new Response('<!doctype html><html><head></head><body><h1>Home</h1></body></html>', {
            headers: {
              'content-type': 'text/html; charset=utf-8'
            }
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
        edge: {
          kind: 'fake',
          worker
        },
        backend: {
          kind: 'fetch-app'
        }
      }
    });

    await expect((await web.fetch('/')).text()).resolves.toContain('<meta name="edge" content="fake">');
  });

  it('redirects and rewrites requests', async () => {
    const worker: EdgeWorker = {
      fetch(request, _env, context) {
        const url = new URL(request.url);
        if (url.pathname === '/old') {
          return Response.redirect(new URL('/new', url), 302);
        }
        if (url.pathname === '/docs') {
          url.pathname = '/docs/index.html';
          return context.next(new Request(url, request));
        }
        return context.next(request);
      }
    };
    const web = await createWebRuntime({
      origin: 'http://localhost:3000',
      app: {
        fetch(request) {
          return new Response(new URL(request.url).pathname);
        }
      },
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        edge: {
          kind: 'fake',
          worker
        },
        backend: {
          kind: 'fetch-app'
        }
      }
    });

    const redirect = await web.fetch('/old', {
      redirect: 'manual'
    });
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get('location')).toBe('http://localhost:3000/new');
    await expect((await web.fetch('/docs')).text()).resolves.toBe('/docs/index.html');
  });

  it('serves static assets from the virtual filesystem', async () => {
    const web = await createWebRuntime({
      origin: 'http://localhost:3000',
      files: {
        '/public/assets/app.js': 'console.log("webRuntime");'
      },
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        edge: {
          kind: 'fake',
          worker: createStaticAssetEdgeWorker({
            publicPrefix: '/assets/',
            filePrefix: '/public/assets/',
            cacheTtl: 3600
          }),
          cache: {
            enabled: true
          }
        },
        backend: {
          kind: 'mock',
          routes: {}
        }
      }
    });

    const response = await web.fetch('/assets/app.js');
    await expect(response.text()).resolves.toBe('console.log("webRuntime");');
    expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
  });

  it('serves edge mock routes', async () => {
    const web = await createWebRuntime({
      origin: 'http://localhost:3000',
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        edge: {
          kind: 'mock',
          routes: {
            '/edge-health': () => Response.json({
              ok: true,
              source: 'edge-mock'
            })
          }
        },
        backend: {
          kind: 'mock',
          routes: {}
        }
      }
    });

    const response = await web.fetch('/edge-health');
    const data = await response.json();

    expect(data).toEqual({
      ok: true,
      source: 'edge-mock'
    });
  });
});
