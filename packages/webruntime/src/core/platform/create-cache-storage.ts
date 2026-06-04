import type {
  WebRuntimeCache,
  WebRuntimeCacheQueryOptions,
  WebRuntimeCacheStorage
} from '../types.ts';

interface CacheEntry {
  request: Request;
  response: Response;
}

export function createWebRuntimeCacheStorage(): WebRuntimeCacheStorage {
  const caches = new Map<string, WebRuntimeCache>();

  return {
    async open(name) {
      const key = String(name);
      let cache = caches.get(key);
      if (!cache) {
        cache = createWebRuntimeCache();
        caches.set(key, cache);
      }
      return cache;
    },
    async has(name) {
      return caches.has(String(name));
    },
    async delete(name) {
      return caches.delete(String(name));
    },
    async keys() {
      return [...caches.keys()].sort();
    },
    async match(request, options) {
      for (const name of [...caches.keys()].sort()) {
        const response = await caches.get(name)?.match(request, options);
        if (response) {
          return response;
        }
      }
      return undefined;
    },
    async clear() {
      caches.clear();
    }
  };
}

function createWebRuntimeCache(): WebRuntimeCache {
  const entries = new Map<string, CacheEntry>();

  return {
    async match(request, options) {
      const lookup = toRequest(request);
      for (const [key, entry] of entries) {
        if (matches(entry.request, lookup, options)) {
          return entry.response.clone();
        }
        if (key === cacheKey(lookup, options)) {
          return entry.response.clone();
        }
      }
      return undefined;
    },
    async put(request, response) {
      const cacheRequest = toRequest(request);
      if (cacheRequest.method !== 'GET' && cacheRequest.method !== 'HEAD') {
        throw new TypeError('WebRuntime cache only supports GET and HEAD requests');
      }
      entries.set(cacheKey(cacheRequest), {
        request: cacheRequest.clone(),
        response: response.clone()
      });
    },
    async delete(request, options) {
      const lookup = toRequest(request);
      let deleted = false;
      for (const [key, entry] of entries) {
        if (matches(entry.request, lookup, options)) {
          deleted = entries.delete(key) || deleted;
        }
      }
      return deleted;
    },
    async keys() {
      return [...entries.values()].map((entry) => entry.request.clone());
    }
  };
}

function toRequest(input: string | URL | Request): Request {
  return input instanceof Request ? input : new Request(input);
}

function matches(
  entry: Request,
  lookup: Request,
  options: WebRuntimeCacheQueryOptions = {}
): boolean {
  if (!options.ignoreMethod && entry.method !== lookup.method) {
    return false;
  }
  const entryUrl = new URL(entry.url);
  const lookupUrl = new URL(lookup.url);
  if (options.ignoreSearch) {
    entryUrl.search = '';
    lookupUrl.search = '';
  }
  return entryUrl.href === lookupUrl.href;
}

function cacheKey(request: Request, options: WebRuntimeCacheQueryOptions = {}): string {
  const url = new URL(request.url);
  if (options.ignoreSearch) {
    url.search = '';
  }
  return `${options.ignoreMethod ? '*' : request.method} ${url.href}`;
}
