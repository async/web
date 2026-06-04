import { describe, expect, it } from 'vitest';
import { createWebRuntime } from '../src/core/create-web-runtime.ts';
import { createWebRuntimeNetwork } from '../src/core/create-web-runtime-network.ts';
import { createJsonLineStreamResponse } from '../src/core/create-stream-response.ts';

describe('webRuntime network streaming', () => {
  it('streams responses across registered WebRuntime origins', async () => {
    const network = createWebRuntimeNetwork();
    const apiWeb = await createWebRuntime({
      origin: 'https://api.local',
      app: {
        fetch() {
          return createJsonLineStreamResponse({
            values: [
              {
                type: 'start'
              },
              {
                type: 'done'
              }
            ],
            headers: {
              'content-type': 'application/x-ndjson'
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
        network: {
          kind: 'blocked'
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

    const response = await web.fetch('https://api.local/events');
    const text = await response.text();

    expect(text.trim().split('\n').map((line) => JSON.parse(line))).toEqual([
      {
        type: 'start'
      },
      {
        type: 'done'
      }
    ]);
    expect(web.trace.entries().map((entry) => entry.boundary)).toContain('web-runtime-network:request');
    expect(web.trace.entries().map((entry) => entry.boundary)).toContain('web-runtime-network:response');
  });
});
