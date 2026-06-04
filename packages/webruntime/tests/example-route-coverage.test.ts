import { describe, expect, it } from 'vitest';
import { createWebRuntime } from '../src/core/create-web-runtime.ts';
import type { WebRuntimeAppDefinition } from '../src/core/types.ts';
import { cdnEdgeCacheWebRuntime } from '../src/examples/cdn-edge-cache/runtime.ts';
import { edgeMiddlewareWebRuntime } from '../src/examples/edge-middleware/runtime.ts';
import { helloAppWebRuntime } from '../src/examples/hello-app/runtime.ts';
import { multiAppNetworkWebRuntime } from '../src/examples/multi-app-network/runtime.ts';
import { platformFetchChainWebRuntime } from '../src/examples/platform-fetch-chain/runtime.ts';
import { requestBodyLabWebRuntime } from '../src/examples/request-body-lab/runtime.ts';
import { serviceWorkerCacheWebRuntime } from '../src/examples/service-worker-cache/runtime.ts';
import { simpleFullstackWebRuntime } from '../src/examples/simple-fullstack/runtime.ts';
import { statefulSessionCacheWebRuntime } from '../src/examples/stateful-session-cache/runtime.ts';
import { streamingAppWebRuntime } from '../src/examples/streaming-app/runtime.ts';

interface ExampleHomeCase {
  name: string;
  definition: WebRuntimeAppDefinition;
  expectedHeading: string;
}

const exampleHomeCases: ExampleHomeCase[] = [
  {
    name: 'hello-app',
    definition: helloAppWebRuntime,
    expectedHeading: '<h1>Home</h1>'
  },
  {
    name: 'streaming-app',
    definition: streamingAppWebRuntime,
    expectedHeading: '<h1>Streaming Home</h1>'
  },
  {
    name: 'simple-fullstack',
    definition: simpleFullstackWebRuntime,
    expectedHeading: '<h1>Simple Fullstack</h1>'
  },
  {
    name: 'service-worker-cache',
    definition: serviceWorkerCacheWebRuntime,
    expectedHeading: '<h1>Service Worker Cache</h1>'
  },
  {
    name: 'cdn-edge-cache',
    definition: cdnEdgeCacheWebRuntime,
    expectedHeading: '<h1>CDN Cache</h1>'
  },
  {
    name: 'edge-middleware',
    definition: edgeMiddlewareWebRuntime,
    expectedHeading: '<h1>Edge Middleware</h1>'
  },
  {
    name: 'multi-app-network',
    definition: multiAppNetworkWebRuntime,
    expectedHeading: '<h1>Multi App Network</h1>'
  },
  {
    name: 'platform-fetch-chain',
    definition: platformFetchChainWebRuntime,
    expectedHeading: '<h1>Platform Fetch Chain</h1>'
  },
  {
    name: 'request-body-lab',
    definition: requestBodyLabWebRuntime,
    expectedHeading: '<h1>Request Body Lab</h1>'
  },
  {
    name: 'stateful-session-cache',
    definition: statefulSessionCacheWebRuntime,
    expectedHeading: '<h1>Stateful Session Cache</h1>'
  }
];

describe('example route coverage', () => {
  it.each(exampleHomeCases)('serves the $name root page', async ({ definition, expectedHeading }) => {
    const web = await createWebRuntime(definition);

    const response = await web.fetch('/');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    await expect(response.text()).resolves.toContain(expectedHeading);
  });

  it('keeps hello-app secondary pages reachable', async () => {
    const web = await createWebRuntime(helloAppWebRuntime);

    const response = await web.fetch('/about');

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain('<h1>About</h1>');
  });

  it('marks streaming-app event responses as non-cacheable NDJSON', async () => {
    const web = await createWebRuntime(streamingAppWebRuntime);

    const response = await web.fetch('/events');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/x-ndjson');
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.text()).resolves.toContain('"chunks":16');
  });

  it('streams long streaming-app HTML content in ordered chunks', async () => {
    const web = await createWebRuntime(streamingAppWebRuntime);

    const response = await web.fetch('/');
    const reader = response.body?.getReader();

    expect(response.status).toBe(200);
    expect(response.headers.get('x-web-runtime-stream')).toBe('1');
    if (!reader) {
      throw new Error('Expected streaming response body');
    }
    const decoder = new TextDecoder();
    const chunks: string[] = [];
    while (true) {
      const result = await reader.read();
      if (result.done) {
        const tail = decoder.decode();
        if (tail) {
          chunks.push(tail);
        }
        break;
      }
      chunks.push(decoder.decode(result.value, {
        stream: true
      }));
    }

    expect(chunks.length).toBeGreaterThan(12);
    expect(chunks[0]).toContain('<h1>Streaming Home</h1>');
    expect(chunks[0]).toContain('id="stream-progress"');
    expect(chunks.some((chunk) => chunk.includes('chunk 16'))).toBe(true);
    expect(chunks.join('')).toContain('Done: WebRuntime streamed and rendered the complete long document.');
  });

  it('lets streaming-app delays be tuned with query params', async () => {
    const web = await createWebRuntime(streamingAppWebRuntime);

    const response = await web.fetch('/?delay=11&firstDelay=22');

    expect(response.status).toBe(200);
    const html = await response.text();

    expect(html).toContain('22ms first-byte delay and 11ms between later chunks');
    expect(html).toContain('href="/events?delay=11&amp;firstDelay=22"');
  });
});
