import { describe, expect, it } from 'vitest';
import { createWebRuntime } from '../src/core/create-web-runtime.ts';

describe('webRuntime pipeline', () => {
  it('runs frontend, service worker, network, edge, and backend boundaries in order', async () => {
    const web = await createWebRuntime({
      origin: 'http://localhost:3000',
      app: {
        fetch(request) {
          return Response.json({
            pathname: new URL(request.url).pathname
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
        network: {
          kind: 'blocked'
        },
        edge: {
          kind: 'bypass'
        },
        backend: {
          kind: 'fetch-app'
        }
      }
    });

    const response = await web.fetch('/about');

    await expect(response.json()).resolves.toEqual({ pathname: '/about' });
    expect(web.trace.entries().map((entry) => entry.boundary)).toEqual([
      'frontend:request',
      'service-worker:request',
      'network:request',
      'edge:request',
      'backend:request',
      'backend:response',
      'edge:response',
      'network:response',
      'service-worker:response',
      'frontend:response'
    ]);
  });

  it('short-circuits blocked cross-origin requests with 502', async () => {
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
          kind: 'mock',
          routes: {}
        }
      }
    });

    const response = await web.fetch('https://api.local/data');

    expect(response.status).toBe(502);
    await expect(response.text()).resolves.toContain('Blocked');
  });

  it('returns 500 and traces errors for thrown backend errors', async () => {
    const web = await createWebRuntime({
      origin: 'http://localhost:3000',
      app: {
        fetch() {
          throw new Error('bad origin');
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

    const response = await web.fetch('/broken');

    expect(response.status).toBe(500);
    expect(web.trace.entries().some((entry) => entry.boundary === 'error')).toBe(true);
  });
});
