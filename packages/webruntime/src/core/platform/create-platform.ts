import { createFakeLocation } from '../create-fake-location.ts';
import { createWebRuntimeCacheStorage } from './create-cache-storage.ts';
import { createWebRuntimeCookieJar } from './create-cookie-jar.ts';
import { createWebRuntimeMessaging, type WebRuntimeMessagingRuntime } from './create-messaging.ts';
import {
  createWebRuntimeCrypto,
  createWebRuntimeNavigator,
  createWebRuntimeTimers,
  getWebRuntimeCustomEventConstructor
} from './create-runtime-apis.ts';
import { createWebRuntimeStorageArea } from './create-storage.ts';
import type {
  FakeLocation,
  WebRuntimeCacheStorage,
  WebRuntimeCookieJar,
  WebRuntimeConfiguredEnvironmentName,
  WebRuntimeEnvironmentConfig,
  WebRuntimeEnvironmentExecutionConfig,
  WebRuntimeEnvironmentMap,
  WebRuntimeEnvironmentName,
  WebRuntimeEnvironmentRuntime,
  WebRuntimePlatform,
  WebRuntimePlatformConfig,
  WebRuntimePlatformFetchHandler
} from '../types.ts';

const environmentNames: WebRuntimeConfiguredEnvironmentName[] = [
  'frontend',
  'serviceWorker',
  'edge',
  'backend'
];

export function createWebRuntimeEnvironmentRuntimes(options: {
  origin: string;
  frontendLocation: FakeLocation;
  config?: Partial<Record<WebRuntimeConfiguredEnvironmentName, WebRuntimeEnvironmentConfig>>;
  platform?: WebRuntimePlatformConfig;
  fetch: WebRuntimePlatformFetchHandler;
}): WebRuntimeEnvironmentMap {
  const origin = new URL(options.origin).origin;
  const cookies = createWebRuntimeCookieJar();
  const messaging = createWebRuntimeMessaging(origin);
  const entries = environmentNames.map((name) => {
    const execution = normalizeExecutionConfig(options.config?.[name]);
    const location = name === 'frontend' && !execution.location
      ? options.frontendLocation
      : createFakeLocation(execution.location ?? `${origin}/`);
    const runtime = createWebRuntimeEnvironmentRuntime({
      name,
      origin,
      execution,
      location,
      cookies,
      messaging,
      platform: options.platform,
      fetch: options.fetch
    });
    return [name, runtime] as const;
  });

  return Object.fromEntries(entries) as WebRuntimeEnvironmentMap;
}

export function createWebRuntimeEnvironmentRuntime(options: {
  name: WebRuntimeEnvironmentName;
  origin: string;
  execution?: WebRuntimeEnvironmentExecutionConfig;
  location?: FakeLocation;
  cookies?: WebRuntimeCookieJar;
  messaging?: WebRuntimeMessagingRuntime;
  platform?: WebRuntimePlatformConfig;
  fetch: WebRuntimePlatformFetchHandler;
}): WebRuntimeEnvironmentRuntime {
  const origin = new URL(options.origin).origin;
  const execution = normalizeExecutionConfig(options.execution);
  const location = options.location ?? createFakeLocation(execution.location ?? `${origin}/`);
  const localStorage = createWebRuntimeStorageArea();
  const sessionStorage = createWebRuntimeStorageArea();
  const cookies = options.cookies ?? createWebRuntimeCookieJar();
  const caches = createWebRuntimeCacheStorage();
  const messaging = options.messaging ?? createWebRuntimeMessaging(origin);
  let runtime: WebRuntimeEnvironmentRuntime;
  const platform = createWebRuntimePlatform({
    name: options.name,
    origin,
    location,
    localStorage,
    sessionStorage,
    cookies,
    caches,
    messaging,
    config: options.platform,
    fetch(input, init) {
      return options.fetch(runtime, input, init);
    }
  });

  runtime = {
    name: options.name,
    execution,
    location,
    platform,
    reset() {
      location.replace(execution.location ?? `${origin}/`);
      platform.reset();
    },
    dispose() {
      platform.dispose();
    }
  };
  return runtime;
}

export function createWebRuntimePlatform(options: {
  name: WebRuntimeEnvironmentName;
  origin: string;
  location: FakeLocation;
  localStorage?: ReturnType<typeof createWebRuntimeStorageArea>;
  sessionStorage?: ReturnType<typeof createWebRuntimeStorageArea>;
  cookies?: WebRuntimeCookieJar;
  caches?: WebRuntimeCacheStorage;
  messaging?: WebRuntimeMessagingRuntime;
  config?: WebRuntimePlatformConfig;
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
}): WebRuntimePlatform {
  const localStorage = options.localStorage ?? createWebRuntimeStorageArea();
  const sessionStorage = options.sessionStorage ?? createWebRuntimeStorageArea();
  const cookies = options.cookies ?? createWebRuntimeCookieJar();
  const caches = options.caches ?? createWebRuntimeCacheStorage();
  const timers = createWebRuntimeTimers();
  const crypto = createWebRuntimeCrypto(options.config);
  const navigator = createWebRuntimeNavigator(options.config);
  const messaging = options.messaging ?? createWebRuntimeMessaging(new URL(options.origin).origin);
  const CustomEventConstructor = getWebRuntimeCustomEventConstructor();
  const platform: WebRuntimePlatform = {
    name: options.name,
    origin: new URL(options.origin).origin,
    location: options.location,
    localStorage,
    sessionStorage,
    cookies,
    caches,
    timers,
    crypto,
    navigator,
    TextEncoder,
    TextDecoder,
    structuredClone,
    atob,
    btoa,
    queueMicrotask,
    EventTarget,
    Event,
    CustomEvent: CustomEventConstructor,
    MessageChannel,
    BroadcastChannel: messaging.BroadcastChannel,
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
    fetch(input, init) {
      return options.fetch(input, init);
    },
    createFetch() {
      return ((input: string | URL | Request, init?: RequestInit) => {
        return platform.fetch(input, init);
      }) as typeof fetch;
    },
    postMessage(message, targetOrigin) {
      messaging.postMessage(message, targetOrigin);
    },
    addEventListener(type, listener) {
      messaging.addEventListener(type, listener);
    },
    removeEventListener(type, listener) {
      messaging.removeEventListener(type, listener);
    },
    reset() {
      localStorage.clear();
      sessionStorage.clear();
      cookies.clear();
      void caches.clear();
      timers.clearAll();
      messaging.reset();
    },
    dispose() {
      timers.clearAll();
      messaging.reset();
    }
  };

  return platform;
}

function normalizeExecutionConfig(
  config?: WebRuntimeEnvironmentConfig
): WebRuntimeEnvironmentExecutionConfig {
  if (!config) {
    return {
      mode: 'same-realm'
    };
  }
  if (config.mode === 'iframe') {
    return {
      mode: 'iframe',
      location: config.location,
      sandbox: config.sandbox
    };
  }
  return {
    mode: 'same-realm',
    location: config.location
  };
}
