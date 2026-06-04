import { describe, expect, it } from 'vitest';
import { createWebRuntime } from '../src/core/create-web-runtime.ts';
import {
  createJsonLineStreamResponse,
  createStreamFromAsyncIterable,
  createTextStreamResponse
} from '../src/core/create-stream-response.ts';

describe('streaming responses', () => {
  it('streams JSON lines in order and traces stream lifecycle', async () => {
    const web = await createWebRuntime({
      origin: 'http://localhost:3000',
      app: {
        fetch() {
          return createJsonLineStreamResponse({
            values: [
              {
                type: 'start'
              },
              {
                type: 'progress',
                value: 50
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
        backend: {
          kind: 'fetch-app'
        }
      }
    });

    const response = await web.fetch('/events');
    const lines = (await response.text()).trim().split('\n').map((line) => JSON.parse(line));

    expect(lines).toEqual([
      {
        type: 'start'
      },
      {
        type: 'progress',
        value: 50
      },
      {
        type: 'done'
      }
    ]);
    const boundaries = web.trace.entries().map((entry) => entry.boundary);
    expect(boundaries).toContain('stream:start');
    expect(boundaries).toContain('stream:chunk');
    expect(boundaries).toContain('stream:end');
  });

  it('stops delayed stream production cleanly when a reader is canceled', async () => {
    const response = createTextStreamResponse({
      chunks: ['first', 'second'],
      firstChunkDelayMs: 10,
      delayMs: 10
    });
    if (!response.body) {
      throw new Error('Expected response body');
    }
    const reader = response.body.getReader();
    const pendingRead = reader.read();

    await reader.cancel();

    await expect(pendingRead).resolves.toMatchObject({
      done: true
    });
    await wait(40);
  });

  it('stops pulling async iterable stream values after cancellation', async () => {
    const pulled: number[] = [];
    async function* values(): AsyncIterable<string> {
      pulled.push(1);
      yield 'first';
      await wait(10);
      pulled.push(2);
      yield 'second';
    }

    const stream = createStreamFromAsyncIterable(values(), {
      delayMs: 10
    });
    const reader = stream.getReader();

    await expect(reader.read()).resolves.toMatchObject({
      value: 'first',
      done: false
    });
    await reader.cancel();
    await wait(40);

    expect(pulled).toEqual([1]);
  });
});

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
