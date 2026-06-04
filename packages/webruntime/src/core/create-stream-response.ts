import { createReadableStreamFromTextChunks } from './stream-utils.ts';

export function createTextStreamResponse(options: {
  chunks: string[];
  delayMs?: number;
  firstChunkDelayMs?: number;
  headers?: HeadersInit;
  status?: number;
}): Response {
  const headers = new Headers(options.headers);
  headers.set('x-web-runtime-stream', '1');
  return new Response(createReadableStreamFromTextChunks(options.chunks, {
    delayMs: options.delayMs,
    firstChunkDelayMs: options.firstChunkDelayMs
  }), {
    status: options.status,
    headers
  });
}

export function createJsonLineStreamResponse(options: {
  values: unknown[];
  delayMs?: number;
  firstChunkDelayMs?: number;
  headers?: HeadersInit;
  status?: number;
}): Response {
  return createTextStreamResponse({
    chunks: options.values.map((value) => `${JSON.stringify(value)}\n`),
    delayMs: options.delayMs,
    firstChunkDelayMs: options.firstChunkDelayMs,
    headers: options.headers,
    status: options.status
  });
}

export function createStreamFromAsyncIterable<T extends Uint8Array | string>(
  iterable: AsyncIterable<T> | Iterable<T>,
  options: {
    delayMs?: number;
    firstChunkDelayMs?: number;
  } = {}
): ReadableStream<T> {
  const iterator = toAsyncIterator(iterable);
  let index = 0;
  let cancelled = false;
  return new ReadableStream<T>({
    async pull(controller) {
      if (cancelled) {
        return;
      }
      const delayMs = index === 0
        ? options.firstChunkDelayMs ?? 0
        : options.delayMs ?? 0;
      if (delayMs > 0) {
        await wait(delayMs);
      }
      if (cancelled) {
        return;
      }
      const result = await iterator.next();
      if (cancelled) {
        return;
      }
      if (result.done) {
        controller.close();
        return;
      }
      controller.enqueue(result.value);
      index += 1;
    },
    async cancel() {
      cancelled = true;
      await iterator.return?.();
    }
  });
}

function toAsyncIterator<T>(
  iterable: AsyncIterable<T> | Iterable<T>
): AsyncIterator<T> {
  if (Symbol.asyncIterator in iterable) {
    return iterable[Symbol.asyncIterator]();
  }
  const iterator = iterable[Symbol.iterator]();
  return {
    async next() {
      return iterator.next();
    },
    async return() {
      if (typeof iterator.return === 'function') {
        return iterator.return();
      }
      return {
        done: true,
        value: undefined as T
      };
    }
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
