import { Window as HappyWindow } from 'happy-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { createRuntimeFrame, createRuntimeFrameTransport } from '../src/browser/create-runtime-frame.ts';
import { createWebRuntime } from '../src/core/create-web-runtime.ts';

const globalScope = globalThis as unknown as {
  document: unknown;
  window: unknown;
};

describe('WebRuntime iframe environment config', () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;

  afterEach(() => {
    globalScope.document = originalDocument;
    globalScope.window = originalWindow;
  });

  it('keeps same-realm as the default and records iframe mode as explicit opt-in', async () => {
    const web = await createWebRuntime({
      origin: 'https://web.local',
      environments: {
        serviceWorker: {
          mode: 'iframe',
          location: 'https://web.local/sw-runtime',
          sandbox: 'allow-scripts'
        }
      },
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        backend: {
          kind: 'mock',
          routes: {}
        }
      }
    });

    expect(web.environments.frontend.execution).toEqual({
      mode: 'same-realm'
    });
    expect(web.environments.serviceWorker.execution).toEqual({
      mode: 'iframe',
      location: 'https://web.local/sw-runtime',
      sandbox: 'allow-scripts'
    });
    expect(web.environments.serviceWorker.location.href).toBe('https://web.local/sw-runtime');
  });

  it('creates WebRuntime-owned runtime frames with location metadata and sandbox controls', () => {
    const window = installWindow();
    const frame = createRuntimeFrame({
      parent: window.document.body as unknown as HTMLElement,
      title: 'Backend runtime',
      className: 'runtime',
      location: 'https://backend.local/runtime',
      sandbox: 'allow-scripts allow-forms',
      srcdoc: '<!doctype html><title>Runtime</title>'
    });

    expect(frame.title).toBe('Backend runtime');
    expect(frame.className).toBe('runtime');
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts allow-forms');
    expect(frame.dataset.webRuntimeLocation).toBe('https://backend.local/runtime');
    expect(frame.srcdoc).toContain('<title>Runtime</title>');
    expect(window.document.querySelectorAll('iframe')).toHaveLength(1);
  });

  it('creates and destroys a runtime frame RPC transport without direct eval hooks', () => {
    const window = installWindow();
    const transport = createRuntimeFrameTransport({
      parent: window.document.body as unknown as HTMLElement,
      location: 'https://edge.local/runtime',
      timeoutMs: 20
    });

    expect(transport.frame.getAttribute('sandbox')).toBe('allow-scripts');
    expect(transport.frame.dataset.webRuntimeLocation).toBe('https://edge.local/runtime');
    expect(typeof transport.client.call).toBe('function');

    transport.destroy();

    expect(window.document.querySelectorAll('iframe')).toHaveLength(0);
  });
});

function installWindow(): HappyWindow {
  const window = new HappyWindow({
    url: 'https://parent.local/'
  });
  globalScope.document = window.document;
  globalScope.window = window;
  return window;
}
