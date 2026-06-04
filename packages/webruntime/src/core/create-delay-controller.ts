import type {
  BoundaryDelayConfig,
  DelayBoundary,
  DelayConfig,
  DelayController,
  PipelineTraceController
} from './types.ts';

export function createWebRuntimeDelayController(
  config: DelayConfig = {},
  trace?: PipelineTraceController
): DelayController {
  return createDelayController(config, trace);
}

export function createDelayController(
  config: DelayConfig = {},
  trace?: PipelineTraceController
): DelayController {
  const enabled = config.enabled ?? true;
  let seed = config.seed;

  async function applyDelay(
    phase: 'request' | 'response',
    boundary: DelayBoundary,
    request: Request,
    response?: Response
  ): Promise<void> {
    if (!enabled) {
      return;
    }
    const boundaryConfig = resolveDelayConfig(boundary, request, config);
    if (boundaryConfig.enabled === false) {
      return;
    }
    const delayMs = withJitter(phase === 'request'
      ? boundaryConfig.requestDelayMs ?? config.requestDelayMs ?? config.defaultDelayMs ?? 0
      : boundaryConfig.responseDelayMs ?? config.responseDelayMs ?? config.defaultDelayMs ?? 0, boundaryConfig);
    if (delayMs <= 0) {
      return;
    }
    trace?.record({
      boundary: 'delay:start',
      method: request.method,
      url: request.url,
      status: response?.status,
      detail: {
        boundary,
        phase,
        delayMs
      }
    });
    await wait(delayMs);
    trace?.record({
      boundary: 'delay:end',
      method: request.method,
      url: request.url,
      status: response?.status,
      detail: {
        boundary,
        phase,
        delayMs
      }
    });
  }

  return {
    delayBoundaryRequest(boundary, request) {
      return applyDelay('request', boundary, request);
    },
    delayBoundaryResponse(boundary, request, response) {
      return applyDelay('response', boundary, request, response);
    },
    delayStream(boundary, request, stream) {
      if (!enabled) {
        return stream;
      }
      const boundaryConfig = resolveDelayConfig(boundary, request, config);
      const firstChunkDelayMs = withJitter(
        boundaryConfig.streamFirstChunkDelayMs ?? config.streamFirstChunkDelayMs ?? 0,
        boundaryConfig
      );
      const chunkDelayMs = withJitter(
        boundaryConfig.streamChunkDelayMs ?? config.streamChunkDelayMs ?? 0,
        boundaryConfig
      );
      if (firstChunkDelayMs <= 0 && chunkDelayMs <= 0) {
        return stream;
      }

      return delayStreamChunks(boundary, request, stream, firstChunkDelayMs, chunkDelayMs, trace);
    },
    wait
  };

  function withJitter(delayMs: number, boundaryConfig: BoundaryDelayConfig): number {
    const jitterMs = boundaryConfig.jitterMs ?? config.jitterMs ?? 0;
    if (delayMs <= 0 || jitterMs <= 0) {
      return delayMs;
    }
    return delayMs + Math.floor(nextRandom() * (jitterMs + 1));
  }

  function nextRandom(): number {
    if (seed === undefined) {
      return Math.random();
    }
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  }
}

function delayStreamChunks<T extends Uint8Array | string>(
  boundary: DelayBoundary,
  request: Request,
  stream: ReadableStream<T>,
  firstChunkDelayMs: number,
  chunkDelayMs: number,
  trace: PipelineTraceController | undefined
): ReadableStream<T> {
  let index = 0;
  return stream.pipeThrough(new TransformStream<T, T>({
    async transform(chunk, controller) {
      const delayMs = index === 0 ? firstChunkDelayMs : chunkDelayMs;
      if (delayMs > 0) {
        trace?.record({
          boundary: 'delay:start',
          method: request.method,
          url: request.url,
          detail: {
            boundary,
            phase: 'stream',
            index,
            delayMs
          }
        });
        await wait(delayMs);
        trace?.record({
          boundary: 'delay:end',
          method: request.method,
          url: request.url,
          detail: {
            boundary,
            phase: 'stream',
            index,
            delayMs
          }
        });
      }
      index += 1;
      controller.enqueue(chunk);
    }
  }));
}

function resolveDelayConfig(
  boundary: DelayBoundary,
  request: Request,
  config: DelayConfig
): BoundaryDelayConfig {
  const route = config.routes?.find((candidate) => {
    const pathname = new URL(request.url).pathname;
    return typeof candidate.pattern === 'string'
      ? pathname.startsWith(candidate.pattern)
      : candidate.pattern.test(pathname);
  });
  return route?.delay ?? config.boundaries?.[boundary] ?? {};
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
