import { describe, expect, it, vi } from 'vitest';
import {
  createWebRuntimePlatformModuleCode,
  createNativePlatformModuleCode,
  webRuntime,
  resolveWebRuntimeViteTarget
} from '../src/vite/index.ts';
import * as nativePlatform from '../src/platform/index.ts';

describe('WebRuntime Vite compile-away plugin', () => {
  it('uses WebRuntime platform imports during dev and native globals during production builds', () => {
    expect(resolveWebRuntimeViteTarget({
      target: 'auto'
    }, 'serve')).toBe('web-runtime');
    expect(resolveWebRuntimeViteTarget({
      target: 'auto'
    }, 'build')).toBe('native');
    expect(resolveWebRuntimeViteTarget({
      target: 'web-runtime'
    }, 'build')).toBe('web-runtime');
    expect(resolveWebRuntimeViteTarget({
      target: 'native'
    }, 'serve')).toBe('native');
  });

  it('emits a native platform module that binds global functions safely', () => {
    const code = createNativePlatformModuleCode();

    expect(code).toContain('globalThis.fetch.bind(globalThis)');
    expect(code).toContain('export const Request = globalThis.Request');
    expect(code).toContain('export const caches = globalThis.caches');
    expect(code).toContain('export const localStorage = globalThis.localStorage');
  });

  it('emits a WebRuntime platform module that routes fetch through the bound platform', async () => {
    const module = await importModule(createWebRuntimePlatformModuleCode({
      environment: 'frontend'
    }));
    const fetch = vi.fn(async () => new Response('from webRuntime'));

    module.setWebRuntimePlatform({
      fetch,
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
      localStorage: createStorageStub(),
      sessionStorage: createStorageStub(),
      cookies: {},
      caches: {},
      timers: {
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        queueMicrotask
      },
      crypto: globalThis.crypto,
      navigator: {
        userAgent: 'test',
        onLine: true,
        language: 'en-US'
      },
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
      postMessage() {
        return;
      },
      addEventListener() {
        return;
      },
      removeEventListener() {
        return;
      }
    });

    const response = await module.fetch('/api/data');

    expect(await response.text()).toBe('from webRuntime');
    expect(fetch).toHaveBeenCalledWith('/api/data', undefined);
  });

  it('emits WebRuntime app auto-binding code for string app definitions', () => {
    const code = createWebRuntimePlatformModuleCode({
      app: '/src/examples/simple-fullstack/runtime.ts'
    });

    expect(code).toContain("import { createWebRuntime as __webRuntimeCreateWebRuntime } from '@async/webruntime'");
    expect(code).toContain('import * as __webRuntimeAppModule from "/src/examples/simple-fullstack/runtime.ts"');
    expect(code).toContain('__webRuntimeAppModule.default ?? __webRuntimeAppModule.webRuntime ?? __webRuntimeAppModule.app');
    expect(code).toContain('__webRuntimeCreateWebRuntime(__webRuntimeAppDefinition)');
  });

  it('resolves @async/webruntime/platform to a virtual module for selected targets', async () => {
    const plugin = webRuntime({
      target: 'web-runtime',
      environment: 'backend'
    }) as any;

    plugin.configResolved?.({
      command: 'serve'
    } as never);
    const resolved = await plugin.resolveId?.('@async/webruntime/platform', undefined, {} as never);
    const code = await plugin.load?.(resolved as string, {} as never);

    expect(resolved).toBe('\0@async/webruntime/platform');
    expect(String(code)).toContain('const defaultEnvironment = "backend"');
    expect(String(code)).toContain('getWebRuntimePlatform().fetch');
  });

  it('resolves @async/web/runtime/platform as the public virtual module id', async () => {
    const plugin = webRuntime({
      target: 'web-runtime'
    }) as any;

    plugin.configResolved?.({
      command: 'serve'
    } as never);
    const resolved = await plugin.resolveId?.('@async/web/runtime/platform', undefined, {} as never);

    expect(resolved).toBe('\0@async/web/runtime/platform');
  });

  it('provides a native fallback facade when the Vite plugin is not active', async () => {
    expect(nativePlatform.Request).toBe(Request);
    expect(nativePlatform.Response).toBe(Response);
    expect(await (await nativePlatform.fetch('data:text/plain,webRuntime')).text()).toBe('webRuntime');
  });
});

async function importModule(code: string): Promise<Record<string, any>> {
  const encoded = Buffer.from(code).toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

function createStorageStub(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };
}
