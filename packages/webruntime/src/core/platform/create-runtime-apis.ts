import type {
  WebRuntimeCrypto,
  WebRuntimeNavigator,
  WebRuntimePlatformConfig,
  WebRuntimeTimers
} from '../types.ts';

export function createWebRuntimeTimers(): WebRuntimeTimers {
  let nextId = 1;
  const timeouts = new Map<number, ReturnType<typeof setTimeout>>();
  const intervals = new Map<number, ReturnType<typeof setInterval>>();

  return {
    setTimeout(handler, timeout, ...arguments_) {
      const id = nextId++;
      const handle = setTimeout(() => {
        timeouts.delete(id);
        runTimerHandler(handler, arguments_);
      }, timeout);
      timeouts.set(id, handle);
      return id;
    },
    clearTimeout(id) {
      const handle = timeouts.get(id);
      if (handle) {
        clearTimeout(handle);
        timeouts.delete(id);
      }
    },
    setInterval(handler, timeout, ...arguments_) {
      const id = nextId++;
      const handle = setInterval(() => {
        runTimerHandler(handler, arguments_);
      }, timeout);
      intervals.set(id, handle);
      return id;
    },
    clearInterval(id) {
      const handle = intervals.get(id);
      if (handle) {
        clearInterval(handle);
        intervals.delete(id);
      }
    },
    queueMicrotask(callback) {
      queueMicrotask(callback);
    },
    clearAll() {
      for (const handle of timeouts.values()) {
        clearTimeout(handle);
      }
      for (const handle of intervals.values()) {
        clearInterval(handle);
      }
      timeouts.clear();
      intervals.clear();
    }
  };
}

export function createWebRuntimeCrypto(config: WebRuntimePlatformConfig = {}): WebRuntimeCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('WebRuntime platform crypto requires globalThis.crypto.subtle');
  }

  if (!config.deterministicCrypto && config.cryptoSeed === undefined) {
    return {
      subtle,
      randomUUID() {
        return globalThis.crypto.randomUUID();
      },
      getRandomValues(array) {
        if (!array) {
          return array;
        }
        globalThis.crypto.getRandomValues(array as ArrayBufferView<ArrayBuffer>);
        return array;
      }
    };
  }

  let state = config.cryptoSeed ?? 1;
  return {
    subtle,
    randomUUID() {
      const bytes = new Uint8Array(16);
      fillDeterministicBytes(bytes, () => {
        state = nextSeed(state);
        return state;
      });
      bytes[6] = (bytes[6]! & 0x0f) | 0x40;
      bytes[8] = (bytes[8]! & 0x3f) | 0x80;
      return formatUuid(bytes);
    },
    getRandomValues(array) {
      if (!array) {
        return array;
      }
      const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      fillDeterministicBytes(bytes, () => {
        state = nextSeed(state);
        return state;
      });
      return array;
    }
  };
}

export function createWebRuntimeNavigator(config: WebRuntimePlatformConfig = {}): WebRuntimeNavigator {
  return {
    userAgent: config.navigator?.userAgent ?? 'WebRuntime/0.0.0',
    onLine: config.navigator?.onLine ?? true,
    language: config.navigator?.language ?? 'en-US'
  };
}

export function getWebRuntimeCustomEventConstructor(): typeof CustomEvent {
  if (typeof globalThis.CustomEvent === 'function') {
    return globalThis.CustomEvent;
  }

  return class WebRuntimeCustomEvent<T = unknown> extends Event implements CustomEvent<T> {
    readonly detail: T;

    constructor(type: string, eventInitDict: CustomEventInit<T> = {}) {
      super(type, eventInitDict);
      this.detail = eventInitDict.detail as T;
    }

    initCustomEvent(): void {
      return;
    }
  } as typeof CustomEvent;
}

function runTimerHandler(handler: TimerHandler, arguments_: unknown[]): void {
  if (typeof handler === 'function') {
    handler(...arguments_);
    return;
  }
  // Browser timers accept strings, but WebRuntime does not eval timer source.
}

function nextSeed(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

function fillDeterministicBytes(bytes: Uint8Array, next: () => number): void {
  let value = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    if (index % 4 === 0) {
      value = next();
    }
    bytes[index] = (value >>> ((index % 4) * 8)) & 0xff;
  }
}

function formatUuid(bytes: Uint8Array): string {
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join('-');
}
