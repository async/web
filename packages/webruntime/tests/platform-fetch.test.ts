import { describe, expect, it, vi } from 'vitest';
import { createFakeFetch } from '../src/core/create-fake-fetch.ts';
import { createWebRuntime } from '../src/core/create-web-runtime.ts';
import { createWebRuntimeNetwork } from '../src/core/create-web-runtime-network.ts';

describe('WebRuntime platform fetch', () => {
  it('exposes same-realm environment runtimes and routes frontend platform fetch through the full pipeline', async () => {
    const seenEnvironments: string[] = [];
    const web = await createWebRuntime({
      origin: 'https://web.local',
      app: {
        fetch(request, _env, context) {
          seenEnvironments.push(context.environment.name);
          return Response.json({
            pathname: new URL(request.url).pathname,
            platform: context.platform.name,
            requestCtor: context.platform.Request === Request
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
        backend: {
          kind: 'fetch-app'
        }
      }
    });

    web.location.assign('/base/page');
    const response = await web.platform.fetch('../api/data');
    const data = await response.json();

    expect(web.platform).toBe(web.environments.frontend.platform);
    expect(web.environments.frontend.execution).toEqual({
      mode: 'same-realm'
    });
    expect(web.environments.backend.execution).toEqual({
      mode: 'same-realm'
    });
    expect(data).toEqual({
      pathname: '/api/data',
      platform: 'backend',
      requestCtor: true
    });
    expect(seenEnvironments).toEqual(['backend']);
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

  it('routes backend platform fetch from the backend environment without re-entering frontend or service worker boundaries', async () => {
    const web = await createWebRuntime({
      origin: 'https://web.local',
      app: {
        async fetch(request, _env, context) {
          const url = new URL(request.url);
          if (url.pathname === '/outer') {
            const inner = await context.platform.fetch('/inner');
            return Response.json({
              outerPlatform: context.platform.name,
              inner: await inner.json()
            });
          }
          return Response.json({
            pathname: url.pathname,
            platform: context.platform.name
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
        backend: {
          kind: 'fetch-app'
        }
      }
    });

    const response = await web.fetch('/outer');
    const data = await response.json();

    expect(data).toEqual({
      outerPlatform: 'backend',
      inner: {
        pathname: '/inner',
        platform: 'backend'
      }
    });

    const boundaries = web.trace.entries().map((entry) => entry.boundary);
    expect(boundaries.filter((boundary) => boundary === 'frontend:request')).toHaveLength(1);
    expect(boundaries.filter((boundary) => boundary === 'service-worker:request')).toHaveLength(1);
    expect(boundaries.filter((boundary) => boundary === 'network:request')).toHaveLength(2);
    expect(boundaries.filter((boundary) => boundary === 'backend:request')).toHaveLength(2);
  });

  it('preserves streamed request bodies and AbortSignal state through platform fetch', async () => {
    const web = await createWebRuntime({
      origin: 'https://web.local',
      app: {
        async fetch(request) {
          return Response.json({
            aborted: request.signal.aborted,
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

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('streamed '));
        controller.enqueue(new TextEncoder().encode('body'));
        controller.close();
      }
    });
    const response = await web.platform.fetch('/echo', {
      method: 'POST',
      body,
      duplex: 'half'
    } as RequestInit & { duplex: 'half' });

    await expect(response.json()).resolves.toEqual({
      aborted: false,
      body: 'streamed body'
    });
  });

  it('rejects platform fetch when the request is aborted before or during dispatch', async () => {
    vi.useFakeTimers();
    try {
      const web = await createWebRuntime({
        origin: 'https://web.local',
        app: {
          async fetch() {
            await new Promise((resolve) => setTimeout(resolve, 100));
            return new Response('late');
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
      const before = new AbortController();
      before.abort();

      await expect(web.platform.fetch('/before', {
        signal: before.signal
      })).rejects.toMatchObject({
        name: 'AbortError'
      });

      const during = new AbortController();
      const promise = web.platform.fetch('/during', {
        signal: during.signal
      });
      during.abort('cancelled');

      await expect(promise).rejects.toMatchObject({
        name: 'AbortError'
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('routes cross-origin platform fetch through WebRuntime network and supports createFakeFetch', async () => {
    const network = createWebRuntimeNetwork();
    const apiWeb = await createWebRuntime({
      origin: 'https://api.local',
      app: {
        fetch(request) {
          return Response.json({
            pathname: new URL(request.url).pathname,
            source: 'api'
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

    const fetch = createFakeFetch(web);
    const response = await fetch('https://api.local/events');
    const data = await response.json();

    expect(data).toEqual({
      pathname: '/events',
      source: 'api'
    });
    expect(web.trace.entries().map((entry) => entry.boundary)).toContain('web-runtime-network:request');
    expect(web.trace.entries().map((entry) => entry.boundary)).toContain('web-runtime-network:response');
  });

  it('keeps iframe environment config opt-in without enabling iframe transport by default', async () => {
    const web = await createWebRuntime({
      origin: 'https://web.local',
      environments: {
        backend: {
          mode: 'iframe',
          location: 'https://backend.local/app',
          sandbox: 'allow-scripts'
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
          kind: 'mock',
          routes: {
            '/app/data': () => new Response('backend')
          }
        }
      }
    });

    expect(web.environments.frontend.execution).toEqual({
      mode: 'same-realm'
    });
    expect(web.environments.backend.execution).toEqual({
      mode: 'iframe',
      location: 'https://backend.local/app',
      sandbox: 'allow-scripts'
    });
    expect(web.environments.backend.location.href).toBe('https://backend.local/app');
  });
});
