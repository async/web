import type { WebRuntime, WebRuntimeNetwork } from './types.ts';

export function createWebRuntimeNetwork(): WebRuntimeNetwork {
  const registry = new Map<string, WebRuntime>();

  return {
    register(origin, web) {
      registry.set(new URL(origin).origin, web);
    },
    unregister(origin) {
      registry.delete(new URL(origin).origin);
    },
    async fetch(request) {
      const target = registry.get(new URL(request.url).origin);
      if (!target) {
        return new Response(`Bad Gateway: no WebRuntime registered for ${new URL(request.url).origin}`, {
          status: 502
        });
      }
      return target.fetch(request);
    },
    origins() {
      return [...registry.keys()].sort();
    }
  };
}
