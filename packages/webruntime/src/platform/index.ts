import type {
  WebRuntimeCacheStorage,
  WebRuntimeCookieJar,
  WebRuntimeTimers
} from '../core/types.ts';

export const fetch = globalThis.fetch.bind(globalThis);
export const Request = globalThis.Request;
export const Response = globalThis.Response;
export const Headers = globalThis.Headers;
export const URL = globalThis.URL;
export const URLSearchParams = globalThis.URLSearchParams;
export const FormData = globalThis.FormData;
export const Blob = globalThis.Blob;
export const File = globalThis.File;
export const AbortController = globalThis.AbortController;
export const AbortSignal = globalThis.AbortSignal;
export const TextEncoder = globalThis.TextEncoder;
export const TextDecoder = globalThis.TextDecoder;
export const structuredClone = globalThis.structuredClone.bind(globalThis);
export const atob = globalThis.atob.bind(globalThis);
export const btoa = globalThis.btoa.bind(globalThis);
export const queueMicrotask = globalThis.queueMicrotask.bind(globalThis);
export const EventTarget = globalThis.EventTarget;
export const Event = globalThis.Event;
export const CustomEvent = globalThis.CustomEvent;
export const MessageChannel = globalThis.MessageChannel;
export const BroadcastChannel = globalThis.BroadcastChannel;
export const crypto = globalThis.crypto;
export const navigator = globalThis.navigator;
export const location = globalThis.location;
export const localStorage = globalThis.localStorage;
export const sessionStorage = globalThis.sessionStorage;
export const caches = globalThis.caches as WebRuntimeCacheStorage | CacheStorage;

export const setTimeout = globalThis.setTimeout.bind(globalThis);
export const clearTimeout = globalThis.clearTimeout.bind(globalThis);
export const setInterval = globalThis.setInterval.bind(globalThis);
export const clearInterval = globalThis.clearInterval.bind(globalThis);

export const timers: WebRuntimeTimers = {
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  queueMicrotask,
  clearAll() {
    return;
  }
};

export const cookies: WebRuntimeCookieJar = {
  getCookieHeader() {
    return getCookieText();
  },
  setCookie(_url, value) {
    const document = getDocument();
    if (!document) {
      return;
    }
    for (const cookie of Array.isArray(value) ? value : [value]) {
      document.cookie = cookie;
    }
  },
  deleteCookie(_url, name) {
    const document = getDocument();
    if (!document) {
      return;
    }
    document.cookie = `${name}=; Max-Age=0; Path=/`;
  },
  clear() {
    const document = getDocument();
    if (!document) {
      return;
    }
    for (const name of Object.keys(parseCookieText(document.cookie))) {
      document.cookie = `${name}=; Max-Age=0; Path=/`;
    }
  },
  snapshot() {
    return parseCookieText(getCookieText());
  }
};

export const postMessage = typeof globalThis.postMessage === 'function'
  ? globalThis.postMessage.bind(globalThis)
  : () => undefined;
export const addEventListener = typeof globalThis.addEventListener === 'function'
  ? globalThis.addEventListener.bind(globalThis)
  : () => undefined;
export const removeEventListener = typeof globalThis.removeEventListener === 'function'
  ? globalThis.removeEventListener.bind(globalThis)
  : () => undefined;

export const ready = Promise.resolve();

export function createFetch(): typeof globalThis.fetch {
  return fetch;
}

export function getWebRuntimePlatform(): Record<string, unknown> {
  return {
    fetch,
    createFetch,
    Request,
    Response,
    Headers,
    URL,
    URLSearchParams,
    FormData,
    Blob,
    File,
    AbortController,
    AbortSignal,
    TextEncoder,
    TextDecoder,
    structuredClone,
    atob,
    btoa,
    queueMicrotask,
    EventTarget,
    Event,
    CustomEvent,
    MessageChannel,
    BroadcastChannel,
    crypto,
    navigator,
    location,
    localStorage,
    sessionStorage,
    caches,
    cookies,
    timers,
    postMessage,
    addEventListener,
    removeEventListener
  };
}

export function setWebRuntimePlatform(): undefined {
  return undefined;
}

export function clearWebRuntimePlatform(): void {
  return;
}

function getDocument(): Document | undefined {
  return typeof document === 'undefined' ? undefined : document;
}

function getCookieText(): string {
  return getDocument()?.cookie ?? '';
}

function parseCookieText(value: string): Record<string, string> {
  const entries = value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const separator = part.indexOf('=');
      if (separator === -1) {
        return [part, ''] as const;
      }
      return [
        part.slice(0, separator),
        part.slice(separator + 1)
      ] as const;
    });
  return Object.fromEntries(entries);
}
