import { proxyRequest, matchMockRoute } from './create-backend-driver.ts';
import type {
  EdgeLayerConfig,
  EdgeWorkerContext,
  WebRuntimeContext,
  WebRuntimeEdgeDriver,
  WebRuntimeEnv,
  PipelineTraceController
} from './types.ts';

export function createEdgeDriver(options: {
  config: EdgeLayerConfig;
  context: WebRuntimeContext;
  env: WebRuntimeEnv;
  trace: PipelineTraceController;
}): WebRuntimeEdgeDriver {
  const { config, context, env, trace } = options;

  return {
    async fetch(request, next) {
      if (config.kind === 'bypass') {
        return next(request);
      }

      if (config.kind === 'http-proxy') {
        return proxyRequest(request, config.targetOrigin);
      }

      if (config.kind === 'mock') {
        return matchMockRoute(config.routes, request, context);
      }

      const region = config.region ?? 'local';
      const cacheEnabled = config.cache?.enabled ?? false;
      if (cacheEnabled && isCacheable(request)) {
        const cached = await context.edgeCache.match(request);
        if (cached) {
          trace.record({
            boundary: 'edge:cache-hit',
            method: request.method,
            url: request.url,
            status: cached.status
          });
          return cached;
        }
        trace.record({
          boundary: 'edge:cache-miss',
          method: request.method,
          url: request.url
        });
      }

      let passThroughOnException = false;
      const workerContext: EdgeWorkerContext = {
        fs: context.fs,
        edgeCache: context.edgeCache,
        trace,
        region,
        waitUntil: context.waitUntil,
        passThroughOnException() {
          passThroughOnException = true;
        },
        next(nextRequest = request) {
          return next(nextRequest);
        }
      };

      try {
        const response = config.worker
          ? await config.worker.fetch(request, {
              ...env,
              EDGE_ENV: env.EDGE_ENV ?? env.NODE_ENV,
              CDN_REGION: region
            }, workerContext)
          : await next(request);

        if (cacheEnabled && isCacheable(request) && !config.worker) {
          await context.edgeCache.put(request, response.clone(), {
            ttl: config.cache?.defaultTtl
          });
          trace.record({
            boundary: 'edge:cache-put',
            method: request.method,
            url: request.url,
            status: response.status
          });
        }
        return response;
      } catch (error) {
        if (passThroughOnException) {
          return next(request);
        }
        throw error;
      }
    }
  };
}

function isCacheable(request: Request): boolean {
  return request.method === 'GET' || request.method === 'HEAD';
}
