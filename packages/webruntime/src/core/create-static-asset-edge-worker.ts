import { contentTypeForPath } from './content-type.ts';
import { normalizeWebRuntimePath } from './path-utils.ts';
import type { EdgeWorker } from './types.ts';

export function createStaticAssetEdgeWorker(options: {
  publicPrefix?: string;
  filePrefix?: string;
  cacheTtl?: number;
}): EdgeWorker {
  const publicPrefix = options.publicPrefix ?? '/assets/';
  const filePrefix = options.filePrefix ?? '/public/assets/';

  return {
    async fetch(request, _env, context) {
      const url = new URL(request.url);
      if (request.method !== 'GET' || !url.pathname.startsWith(publicPrefix)) {
        return context.next(request);
      }

      const cached = await context.edgeCache.match(request);
      if (cached) {
        return cached;
      }

      const rest = url.pathname.slice(publicPrefix.length);
      const filePath = normalizeWebRuntimePath(`${filePrefix}/${rest}`);
      if (!(await context.fs.exists(filePath))) {
        return new Response('Not found', {
          status: 404
        });
      }

      const response = new Response(await context.fs.readFile(filePath), {
        headers: {
          'content-type': contentTypeForPath(filePath)
        }
      });
      await context.edgeCache.put(request, response.clone(), {
        ttl: options.cacheTtl,
        tags: ['static-assets']
      });
      return response;
    }
  };
}
