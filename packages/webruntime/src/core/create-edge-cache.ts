import type {
  EdgeCache,
  EdgeCacheConfig,
  EdgeCacheEntryInfo,
  EdgeCacheMatchOptions,
  EdgeCachePutOptions
} from './types.ts';

interface StoredEdgeCacheEntry {
  info: EdgeCacheEntryInfo;
  headers: [string, string][];
  body: ArrayBuffer;
  vary: string[];
  varyHeaders: [string, string][];
}

export function createWebRuntimeEdgeCache(config: EdgeCacheConfig = {}): EdgeCache {
  return createEdgeCache(config);
}

export function createEdgeCache(config: EdgeCacheConfig = {}): EdgeCache {
  const enabled = config.enabled ?? true;
  const defaultTtl = config.defaultTtl;
  const respectCacheControl = config.respectCacheControl ?? false;
  const store = new Map<string, StoredEdgeCacheEntry>();

  async function match(request: Request, options: EdgeCacheMatchOptions = {}): Promise<Response | undefined> {
    if (!enabled) {
      return undefined;
    }

    const entry = [...store.values()].find((candidate) => matchesStoredEntry(candidate, request, options));
    if (!entry) {
      return undefined;
    }
    if (entry.info.expiresAt !== undefined && entry.info.expiresAt <= Date.now()) {
      store.delete(entry.info.key);
      return undefined;
    }
    return new Response(entry.body.slice(0), {
      status: entry.info.status,
      headers: entry.headers
    });
  }

  return {
    match,
    async put(request, response, options = {}) {
      if (!enabled || !isCacheableMethod(request.method)) {
        return;
      }

      const cacheControl = response.headers.get('cache-control') ?? '';
      if (/\bno-store\b/i.test(cacheControl)) {
        return;
      }

      const vary = normalizeVary(options.vary ?? parseVaryHeader(response.headers.get('vary')));
      if (vary.includes('*')) {
        return;
      }

      const ttl = options.ttl ?? (respectCacheControl ? ttlFromCacheControl(cacheControl) : undefined) ?? defaultTtl;
      const createdAt = Date.now();
      const expiresAt = ttl === undefined ? undefined : createdAt + ttl * 1000;
      const key = createCacheKey(request, vary);
      const body = await response.clone().arrayBuffer();
      const info: EdgeCacheEntryInfo = {
        key,
        url: request.url,
        method: request.method.toUpperCase(),
        status: response.status,
        createdAt,
        expiresAt,
        tags: options.tags ?? []
      };

      store.set(key, {
        info,
        headers: [...response.headers.entries()],
        body,
        vary,
        varyHeaders: vary.map((header) => [header, request.headers.get(header) ?? ''])
      });
    },
    async delete(request) {
      const keyPrefix = createCacheKeyPrefix(request, {});
      let deleted = false;
      for (const key of [...store.keys()]) {
        if (key.startsWith(keyPrefix)) {
          store.delete(key);
          deleted = true;
        }
      }
      return deleted;
    },
    async purgeByTag(tag) {
      let count = 0;
      for (const [key, entry] of store) {
        if (entry.info.tags.includes(tag)) {
          store.delete(key);
          count += 1;
        }
      }
      return count;
    },
    async purgeByPath(pathname) {
      let count = 0;
      for (const [key, entry] of store) {
        if (new URL(entry.info.url).pathname === pathname) {
          store.delete(key);
          count += 1;
        }
      }
      return count;
    },
    async purgeAll() {
      store.clear();
    },
    async keys() {
      return [...store.values()].map((entry) => ({ ...entry.info }));
    }
  };
}

function createCacheKey(request: Request, vary: string[] = []): string {
  const url = new URL(request.url);
  const varyParts = vary.map((header) => `${header.toLowerCase()}=${request.headers.get(header) ?? ''}`);
  return `${request.method.toUpperCase()} ${url.href} ${varyParts.join('&')}`;
}

function matchesStoredEntry(
  entry: StoredEdgeCacheEntry,
  request: Request,
  options: EdgeCacheMatchOptions
): boolean {
  if (!options.ignoreMethod && entry.info.method !== request.method.toUpperCase()) {
    return false;
  }

  const requestUrl = new URL(request.url);
  const entryUrl = new URL(entry.info.url);
  if (options.ignoreSearch) {
    requestUrl.search = '';
    entryUrl.search = '';
  }
  if (requestUrl.href !== entryUrl.href) {
    return false;
  }

  return entry.varyHeaders.every(([header, value]) => (request.headers.get(header) ?? '') === value);
}

function createCacheKeyPrefix(request: Request, options: EdgeCacheMatchOptions): string {
  const url = new URL(request.url);
  if (options.ignoreSearch) {
    url.search = '';
  }
  const method = options.ignoreMethod ? '' : `${request.method.toUpperCase()} `;
  return `${method}${url.href}`;
}

function isCacheableMethod(method: string): boolean {
  return method.toUpperCase() === 'GET' || method.toUpperCase() === 'HEAD';
}

function ttlFromCacheControl(cacheControl: string): number | undefined {
  const sMaxAge = cacheControl.match(/\bs-maxage=(\d+)/i)?.[1];
  if (sMaxAge) {
    return Number(sMaxAge);
  }
  const maxAge = cacheControl.match(/\bmax-age=(\d+)/i)?.[1];
  if (maxAge) {
    return Number(maxAge);
  }
  return undefined;
}

function normalizeVary(vary: string[] = []): string[] {
  return [...new Set(vary.map((header) => header.trim().toLowerCase()).filter(Boolean))].sort();
}

function parseVaryHeader(value: string | null): string[] {
  if (!value) {
    return [];
  }
  return value.split(',');
}
