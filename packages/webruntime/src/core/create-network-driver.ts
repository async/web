import type {
  WebRuntimeNetwork,
  WebRuntimeNetworkDriver,
  NetworkLayerConfig
} from './types.ts';

export function createNetworkDriver(options: {
  origin: string;
  config: NetworkLayerConfig;
  network?: WebRuntimeNetwork;
}): WebRuntimeNetworkDriver {
  const origin = new URL(options.origin).origin;
  const { config, network } = options;

  return {
    async fetch(request, next) {
      const url = new URL(request.url);
      if (url.origin === origin) {
        return next();
      }

      if (config.kind === 'real-fetch') {
        return fetch(request);
      }

      if (config.kind === 'web-runtime-network') {
        if (network) {
          return network.fetch(request);
        }
        if (config.allowExternalFetch) {
          return fetch(request);
        }
      }

      return new Response(`Blocked WebRuntime network request: ${request.url}`, {
        status: 502
      });
    }
  };
}
