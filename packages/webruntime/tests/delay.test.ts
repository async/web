import { describe, expect, it } from 'vitest';
import { createWebRuntime } from '../src/core/create-web-runtime.ts';
import { createTextStreamResponse } from '../src/core/create-stream-response.ts';

describe('delay controller', () => {
  it('records global request and response delays', async () => {
    const web = await createWebRuntime({
      origin: 'http://localhost:3000',
      delay: {
        defaultDelayMs: 1
      },
      app: {
        fetch() {
          return Response.json({ ok: true });
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

    const response = await web.fetch('/api/time');

    await expect(response.json()).resolves.toEqual({ ok: true });
    const boundaries = web.trace.entries().map((entry) => entry.boundary);
    expect(boundaries).toContain('delay:start');
    expect(boundaries).toContain('delay:end');
  });

  it('applies boundary-specific delay detail', async () => {
    const web = await createWebRuntime({
      origin: 'http://localhost:3000',
      delay: {
        defaultDelayMs: 0,
        boundaries: {
          backend: {
            requestDelayMs: 1
          }
        }
      },
      app: {
        fetch() {
          return new Response('ok');
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

    await web.fetch('/api/time');

    expect(web.trace.entries()).toContainEqual(expect.objectContaining({
      boundary: 'delay:start',
      detail: expect.objectContaining({
        boundary: 'backend'
      })
    }));
  });

  it('applies route-specific delays', async () => {
    const web = await createWebRuntime({
      origin: 'http://localhost:3000',
      delay: {
        defaultDelayMs: 0,
        routes: [
          {
            pattern: '/api/slow',
            delay: {
              requestDelayMs: 1
            }
          }
        ]
      },
      app: {
        fetch() {
          return new Response('ok');
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

    await web.fetch('/api/slow');

    expect(web.trace.entries()).toContainEqual(expect.objectContaining({
      boundary: 'delay:start',
      url: 'http://localhost:3000/api/slow',
      detail: expect.objectContaining({
        phase: 'request',
        delayMs: 1
      })
    }));
  });

  it('applies stream chunk delays and records delay traces', async () => {
    const web = await createWebRuntime({
      origin: 'http://localhost:3000',
      delay: {
        defaultDelayMs: 0,
        boundaries: {
          backend: {
            streamFirstChunkDelayMs: 1,
            streamChunkDelayMs: 1
          }
        }
      },
      app: {
        fetch() {
          return createTextStreamResponse({
            chunks: ['a', 'b'],
            headers: {
              'content-type': 'text/plain; charset=utf-8'
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
        backend: {
          kind: 'fetch-app'
        }
      }
    });

    const response = await web.fetch('/stream');

    await expect(response.text()).resolves.toBe('ab');
    expect(web.trace.entries()).toContainEqual(expect.objectContaining({
      boundary: 'delay:start',
      detail: expect.objectContaining({
        boundary: 'backend',
        phase: 'stream',
        index: 0
      })
    }));
  });
});
