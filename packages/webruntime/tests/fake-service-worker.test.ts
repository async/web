import { describe, expect, it } from 'vitest';
import { createWebRuntimeContext } from '../src/core/create-web-runtime.ts';
import { createFakeServiceWorker } from '../src/core/create-fake-service-worker.ts';

describe('fake service worker', () => {
  it('short-circuits matching route handlers', async () => {
    const serviceWorker = createFakeServiceWorker();
    const context = createWebRuntimeContext({
      origin: 'http://localhost:3000'
    });

    serviceWorker.route('/api/cached', () => Response.json({ source: 'sw' }));

    const response = await serviceWorker.dispatchFetch(
      new Request('http://localhost:3000/api/cached'),
      context,
      () => Response.json({ source: 'network' })
    );

    await expect(response.json()).resolves.toEqual({ source: 'sw' });
  });

  it('supports fetch event respondWith', async () => {
    const serviceWorker = createFakeServiceWorker();
    const context = createWebRuntimeContext({
      origin: 'http://localhost:3000'
    });

    serviceWorker.addEventListener('fetch', (event) => {
      if (new URL(event.request.url).pathname === '/event') {
        event.respondWith(new Response('from event'));
      }
    });

    const response = await serviceWorker.dispatchFetch(
      new Request('http://localhost:3000/event'),
      context,
      () => new Response('from next')
    );

    await expect(response.text()).resolves.toBe('from event');
  });

  it('reads built-in virtual files and otherwise calls next', async () => {
    const serviceWorker = createFakeServiceWorker();
    const context = createWebRuntimeContext({
      origin: 'http://localhost:3000',
      files: {
        '/hello.txt': 'Hello'
      }
    });

    const fileResponse = await serviceWorker.dispatchFetch(
      new Request('http://localhost:3000/__webruntime/files/hello.txt'),
      context,
      () => new Response('from next')
    );
    const nextResponse = await serviceWorker.dispatchFetch(
      new Request('http://localhost:3000/api/time'),
      context,
      () => new Response('from next')
    );

    await expect(fileResponse.text()).resolves.toBe('Hello');
    await expect(nextResponse.text()).resolves.toBe('from next');
  });
});
