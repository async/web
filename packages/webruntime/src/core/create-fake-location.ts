import type { FakeLocation } from './types.ts';

export function createFakeLocation(initialUrl: string): FakeLocation {
  let current = parseWebRuntimeUrl(initialUrl, undefined);

  function set(url: string): void {
    current = parseWebRuntimeUrl(url, current);
  }

  return {
    get href() {
      return current.href;
    },
    get origin() {
      return current.origin;
    },
    get protocol() {
      return current.protocol;
    },
    get host() {
      return current.host;
    },
    get hostname() {
      return current.hostname;
    },
    get port() {
      return current.port;
    },
    get pathname() {
      return current.pathname;
    },
    get search() {
      return current.search;
    },
    get hash() {
      return current.hash;
    },
    assign(url) {
      set(url);
    },
    replace(url) {
      set(url);
    },
    reload() {
      current = new URL(current.href);
    },
    toString() {
      return current.href;
    },
    toRequest(init) {
      return new Request(current.href, init);
    }
  };
}

export function parseWebRuntimeUrl(url: string, base: URL | undefined): URL {
  try {
    return new URL(url, base);
  } catch (error) {
    throw new Error(`Invalid WebRuntime URL: ${url}`, {
      cause: error
    });
  }
}
