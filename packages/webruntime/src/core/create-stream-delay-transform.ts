import type { WebRuntimeTraceEntry } from './types.ts';

export function createStreamDelayTransform<T>(options: {
  firstChunkDelayMs?: number;
  chunkDelayMs?: number;
  onChunk?: (chunk: T, index: number) => void;
}): TransformStream<T, T> {
  let index = 0;

  return new TransformStream<T, T>({
    async transform(chunk, controller) {
      const delayMs = index === 0
        ? options.firstChunkDelayMs ?? 0
        : options.chunkDelayMs ?? 0;
      if (delayMs > 0) {
        await wait(delayMs);
      }
      options.onChunk?.(chunk, index);
      index += 1;
      controller.enqueue(chunk);
    }
  });
}

export function recordStreamLifecycle(
  trace: { record(entry: Omit<WebRuntimeTraceEntry, 'id' | 'timestamp'>): void },
  request: Request,
  response: Response
): Response {
  if (!response.body) {
    return response;
  }

  let chunkIndex = 0;
  const stream = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    start() {
      trace.record({
        boundary: 'stream:start',
        method: request.method,
        url: request.url,
        status: response.status
      });
    },
    transform(chunk, controller) {
      trace.record({
        boundary: 'stream:chunk',
        method: request.method,
        url: request.url,
        status: response.status,
        detail: {
          index: chunkIndex++,
          size: chunk.byteLength
        }
      });
      controller.enqueue(chunk);
    },
    flush() {
      trace.record({
        boundary: 'stream:end',
        method: request.method,
        url: request.url,
        status: response.status
      });
    }
  }));

  return new Response(stream, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
