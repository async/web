import { readFile } from 'node:fs/promises';
import { Window as HappyWindow } from 'happy-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { bootBrowserShell } from '../src/browser/boot-browser-shell.ts';
import { createBrowserWebRuntime } from '../src/browser/create-browser-web-runtime.ts';
import { helloApp } from '../src/examples/hello-app/manifest.ts';

describe('browser webRuntime', () => {
  const globalScope = globalThis as unknown as {
    window: unknown;
    document: unknown;
    Element: unknown;
    HTMLFormElement: unknown;
    FormData: unknown;
  };
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalElement = globalThis.Element;
  const originalHtmlFormElement = globalThis.HTMLFormElement;
  const originalFormData = globalThis.FormData;

  afterEach(() => {
    globalScope.window = originalWindow;
    globalScope.document = originalDocument;
    globalScope.Element = originalElement;
    globalScope.HTMLFormElement = originalHtmlFormElement;
    globalScope.FormData = originalFormData;
  });

  it('renders navigations into a browser frame', async () => {
    const window = new HappyWindow({
      url: 'http://localhost:5173/'
    });
    const frame = window.document.createElement('iframe') as unknown as HTMLIFrameElement;
    window.document.body.append(frame as never);

    const web = await createBrowserWebRuntime({
      origin: 'http://localhost:3000',
      files: helloApp.files,
      app: helloApp.app,
      pipeline: {
        frontend: {
          kind: 'browser-frame',
          frame
        },
        serviceWorker: {
          kind: 'fake'
        },
        network: {
          kind: 'blocked'
        },
        edge: {
          kind: 'bypass'
        },
        backend: {
          kind: 'fetch-app'
        }
      }
    });

    await web.navigate('/');
    expect(frame.srcdoc).toContain('<h1>Home</h1>');
    await web.navigate('/about');
    expect(web.location.pathname).toBe('/about');
    expect(frame.srcdoc).toContain('<h1>About</h1>');
  });

  it('intercepts same-origin frame clicks but leaves external links alone', async () => {
    const window = installWindow();
    const frame = window.document.createElement('iframe') as unknown as HTMLIFrameElement;
    window.document.body.append(frame as never);
    const web = await createBrowserWebRuntime({
      origin: 'http://localhost:3000',
      app: {
        fetch(request) {
          const url = new URL(request.url);
          if (url.pathname === '/') {
            return html(`
              <h1>Home</h1>
              <a id="about" href="/about">About</a>
              <a id="external" href="https://example.com/out">External</a>
            `);
          }
          return html('<h1>About</h1>');
        }
      },
      pipeline: {
        frontend: {
          kind: 'browser-frame',
          frame
        },
        serviceWorker: {
          kind: 'bypass'
        },
        backend: {
          kind: 'fetch-app'
        }
      }
    });

    await web.navigate('/');
    await nextTask();
    installForeignElementConstructors();

    clickFrameElement(window, frame, '#about');
    await nextTask();

    expect(web.location.pathname).toBe('/about');
    expect(frame.srcdoc).toContain('<h1>About</h1>');

    await web.navigate('/');
    await nextTask();
    installForeignElementConstructors();
    clickFrameElement(window, frame, '#external');
    await nextTask();

    expect(web.location.pathname).toBe('/');
  });

  it('submits same-origin GET forms and syncs the real URL path', async () => {
    const window = installWindow();
    const frame = window.document.createElement('iframe') as unknown as HTMLIFrameElement;
    window.document.body.append(frame as never);
    const web = await createBrowserWebRuntime({
      origin: 'http://localhost:3000',
      app: {
        fetch(request) {
          const url = new URL(request.url);
          if (url.pathname === '/') {
            return html(`
              <h1>Search</h1>
              <form id="search" action="/search" method="GET">
                <input name="q" value="webRuntime">
                <button>Search</button>
              </form>
            `);
          }
          return html(`<h1>${url.pathname}:${url.searchParams.get('q')}</h1>`);
        }
      },
      pipeline: {
        frontend: {
          kind: 'browser-frame',
          frame
        },
        serviceWorker: {
          kind: 'bypass'
        },
        backend: {
          kind: 'fetch-app'
        }
      },
      ui: {
        syncRealUrl: true,
        realUrlBasePath: '/webRuntime'
      }
    });

    await web.navigate('/');
    await nextTask();
    installForeignElementConstructors();
    submitFrameForm(window, frame, '#search');
    await nextTask();

    expect(web.location.pathname).toBe('/search');
    expect(web.location.search).toBe('?q=webRuntime');
    expect(frame.srcdoc).toContain('<h1>/search:webRuntime</h1>');
    expect(window.location.pathname).toBe('/webRuntime/search');
    expect(window.location.search).toBe('?q=webRuntime');
  });

  it('boots the browser shell with an example directory and runtime presets', async () => {
    const window = installWindow();
    window.document.body.innerHTML = `
      <select id="runtime-mode">
        <option value="same-realm">Same realm</option>
        <option value="backend-iframe">Backend iframe</option>
        <option value="two-iframes">Two iframes</option>
      </select>
      <input id="fake-url" value="/">
      <iframe id="preview"></iframe>
      <input id="terminal-command" value="help">
      <pre id="terminal-output"></pre>
      <pre id="trace-output"></pre>
      <pre id="cache-output"></pre>
      <span id="status"></span>
    `;

    await bootBrowserShell(window.document as unknown as Document);
    const frame = window.document.querySelector('#preview') as unknown as HTMLIFrameElement | null;
    expect(frame?.srcdoc).toContain('<h1>WebRuntime Examples</h1>');
    expect(frame?.srcdoc).toContain('Hello App');
    expect(frame?.srcdoc).toContain('Streaming App');
    expect(frame?.srcdoc).toContain('Simple Fullstack');
    expect(frame?.srcdoc).toContain('Service Worker Cache');
    expect(frame?.srcdoc).toContain('CDN Edge Cache');
    expect(frame?.srcdoc).toContain('Edge Middleware');
    expect(frame?.srcdoc).toContain('Multi-App Network');
    expect(frame?.srcdoc).toContain('Platform Fetch Chain');
    expect(frame?.srcdoc).toContain('Request Body Lab');
    expect(frame?.srcdoc).toContain('Stateful Session Cache');
    expect(frame?.srcdoc).toContain('Each demo opens into its own route');
    expect(frame?.srcdoc).toContain('<b>Apps</b>');
    expect(frame?.srcdoc).toContain('<b>Runtime</b>');
    expect(frame?.srcdoc).toContain('<b>Routes</b>');
    expect(frame?.srcdoc).toContain('<b>Behavior</b>');
    expect(frame?.srcdoc.match(/href="\/examples\//g)).toHaveLength(10);
    expect(frame?.srcdoc).toContain('touch-action: manipulation');

    await nextTask();
    installForeignElementConstructors();
    clickFrameElement(window, frame!, 'a[href="/examples/simple-fullstack/"]');
    await nextTask();
    expect(frame?.srcdoc).toContain('<h1>Simple Fullstack</h1>');
    expect(window.document.querySelector('#trace-output')?.textContent).toContain(
      '---------------- new request/response cycle ----------------'
    );

    const runtimeMode = window.document.querySelector('#runtime-mode') as unknown as HTMLSelectElement | null;
    if (!runtimeMode) {
      throw new Error('Missing runtime mode select');
    }
    runtimeMode.value = 'backend-iframe';
    runtimeMode.dispatchEvent(new window.Event('change') as unknown as Event);
    await nextTask();
    expect(frame?.srcdoc).toContain('<h1>Simple Fullstack</h1>');

    runtimeMode.value = 'two-iframes';
    runtimeMode.dispatchEvent(new window.Event('change') as unknown as Event);
    await nextTask();
    expect(frame?.srcdoc).toContain('<h1>Simple Fullstack</h1>');
  });

  it('labels fake browser icon buttons with delayed tooltips', async () => {
    const html = await readFile(new URL('../src/browser/index.html', import.meta.url), 'utf8');
    const main = await readFile(new URL('../src/browser/main.ts', import.meta.url), 'utf8');
    const shell = await readFile(new URL('../src/browser/boot-browser-shell.ts', import.meta.url), 'utf8');

    expect(html).toContain('data-tooltip="Back in fake history"');
    expect(html).toContain('data-tooltip="Forward in fake history"');
    expect(html).toContain('data-tooltip="Reload current fake URL"');
    expect(html).toContain('data-tooltip="Open typed fake URL"');
    expect(html).toContain('data-tooltip="Reset WebRuntime runtime"');
    expect(html).toContain('data-tooltip="Purge edge cache"');
    expect(html).toContain('data-tooltip="Run terminal command"');
    expect(html).toContain('z-index: 10000');
    expect(html).toContain('.webRuntime-tooltip.is-visible');
    expect(html).toContain('id="stream-status"');
    expect(html).toContain('.stream-status__latest');
    expect(main).toContain('const TOOLTIP_DELAY_MS = 650');
    expect(main).toContain("root.body.append(tooltip)");
    expect(shell).toContain('Waiting for first chunk');
    expect(shell).toContain('complete text response rendered');
  });

  it('serves advanced browser shell examples from the directory route graph', async () => {
    const window = installWindow();
    window.document.body.innerHTML = `
      <select id="runtime-mode">
        <option value="same-realm">Same realm</option>
        <option value="backend-iframe">Backend iframe</option>
        <option value="two-iframes">Two iframes</option>
      </select>
      <input id="fake-url" value="/">
      <iframe id="preview"></iframe>
      <input id="terminal-command" value="help">
      <pre id="terminal-output"></pre>
      <pre id="trace-output"></pre>
      <pre id="cache-output"></pre>
      <span id="status"></span>
    `;

    const web = await bootBrowserShell(window.document as unknown as Document);

    await expect((await web.fetch('/examples/hello-app/api/time')).json()).resolves.toMatchObject({
      source: 'fake-node'
    });
    await expect((await web.fetch('/examples/streaming-app/events?delay=0&firstDelay=0')).text()).resolves.toContain('"type":"done"');
    await expect((await web.fetch('/examples/platform-fetch-chain/api/outer')).json()).resolves.toEqual({
      source: 'outer',
      inner: {
        source: 'inner',
        path: '/inner'
      }
    });
    await expect((await web.fetch('/examples/request-body-lab/api/echo', {
      method: 'POST',
      body: 'hello'
    })).json()).resolves.toEqual({
      method: 'POST',
      body: 'hello'
    });
    await expect((await web.fetch('/examples/stateful-session-cache/api/session')).json()).resolves.toEqual({
      cookie: 'seen=true'
    });
    await expect((await web.fetch('/examples/stateful-session-cache/api/cache')).json()).resolves.toEqual({
      cacheHit: false,
      value: 1
    });
    await expect((await web.fetch('/examples/stateful-session-cache/api/cache')).json()).resolves.toEqual({
      cacheHit: true,
      value: 1
    });
  });

  it('renders the streaming shell demo with query-configured delays', async () => {
    const window = installWindow();
    window.document.body.innerHTML = `
      <select id="runtime-mode">
        <option value="same-realm">Same realm</option>
        <option value="backend-iframe">Backend iframe</option>
        <option value="two-iframes">Two iframes</option>
      </select>
      <input id="fake-url" value="/">
      <iframe id="preview"></iframe>
      <div id="stream-status"></div>
      <input id="terminal-command" value="help">
      <pre id="terminal-output"></pre>
      <pre id="trace-output"></pre>
      <pre id="cache-output"></pre>
      <span id="status"></span>
    `;

    await bootBrowserShell(window.document as unknown as Document, '/examples/streaming-app/?delay=0&firstDelay=0');

    const frame = window.document.querySelector('#preview') as unknown as HTMLIFrameElement | null;
    const frameText = frame?.contentDocument?.body.textContent ?? frame?.srcdoc ?? '';
    expect((window.document.querySelector('#fake-url') as unknown as HTMLInputElement | null)?.value).toBe(
      '/examples/streaming-app/?delay=0&firstDelay=0'
    );
    expect(frameText).toContain('Streaming Home');
    expect(frameText).toContain('stream-progress');
    expect(frameText).toContain('webruntime:stream-chunk');
    expect(frameText).toContain('Done: WebRuntime streamed and rendered the complete long document.');
    expect(window.document.querySelector('#stream-status')?.textContent).toContain('Stream complete');
  });

  it('does not let a stale delayed stream overwrite a newer navigation', async () => {
    const window = installWindow();
    window.document.body.innerHTML = `
      <select id="runtime-mode">
        <option value="same-realm">Same realm</option>
        <option value="backend-iframe">Backend iframe</option>
        <option value="two-iframes">Two iframes</option>
      </select>
      <input id="fake-url" value="/">
      <button data-action="run">Run</button>
      <iframe id="preview"></iframe>
      <div id="stream-status"></div>
      <input id="terminal-command" value="help">
      <pre id="terminal-output"></pre>
      <pre id="trace-output"></pre>
      <pre id="cache-output"></pre>
      <span id="status"></span>
    `;

    await bootBrowserShell(window.document as unknown as Document, '/examples/hello-app/');
    const frame = window.document.querySelector('#preview') as unknown as HTMLIFrameElement | null;
    const urlInput = window.document.querySelector('#fake-url') as unknown as HTMLInputElement | null;
    const runButton = window.document.querySelector('[data-action="run"]');
    if (!frame || !urlInput || !runButton) {
      throw new Error('Missing shell test elements');
    }

    urlInput.value = '/examples/streaming-app/?delay=2&firstDelay=40';
    runButton.dispatchEvent(new window.MouseEvent('click', {
      bubbles: true,
      cancelable: true
    }) as never);
    await nextTask();

    urlInput.value = '/examples/hello-app/about';
    runButton.dispatchEvent(new window.MouseEvent('click', {
      bubbles: true,
      cancelable: true
    }) as never);

    await wait(180);

    const frameText = frame.contentDocument?.body.textContent ?? frame.srcdoc;
    expect(urlInput.value).toBe('/examples/hello-app/about');
    expect(frameText).toContain('About');
    expect(frameText).not.toContain('Streaming Home');
    expect((window.document.querySelector('#stream-status') as HTMLElement | null)?.hidden).toBe(true);
  });

  it('keeps root-relative links inside the mounted browser shell example', async () => {
    const window = installWindow();
    window.document.body.innerHTML = `
      <select id="runtime-mode">
        <option value="same-realm">Same realm</option>
        <option value="backend-iframe">Backend iframe</option>
        <option value="two-iframes">Two iframes</option>
      </select>
      <input id="fake-url" value="/">
      <iframe id="preview"></iframe>
      <input id="terminal-command" value="help">
      <pre id="terminal-output"></pre>
      <pre id="trace-output"></pre>
      <pre id="cache-output"></pre>
      <span id="status"></span>
    `;

    await bootBrowserShell(window.document as unknown as Document);
    const frame = window.document.querySelector('#preview') as unknown as HTMLIFrameElement | null;
    await nextTask();
    installForeignElementConstructors();

    clickFrameElement(window, frame!, 'a[href="/examples/hello-app/"]');
    await nextTask();
    installForeignElementConstructors();
    clickFrameElement(window, frame!, 'a[href="/api/time"]');
    await nextTask();

    const urlInput = window.document.querySelector('#fake-url') as unknown as HTMLInputElement | null;
    expect(urlInput?.value).toBe('/examples/hello-app/api/time');
    expect(frame?.srcdoc).toContain('fake-node');
  });
});

function installWindow(): HappyWindow {
  const window = new HappyWindow({
    url: 'http://localhost:5173/'
  });
  const globalScope = globalThis as unknown as {
    window: unknown;
    document: unknown;
    Element: unknown;
    HTMLFormElement: unknown;
    FormData: unknown;
  };
  globalScope.window = window;
  globalScope.document = window.document;
  globalScope.Element = window.Element;
  globalScope.HTMLFormElement = window.HTMLFormElement;
  globalScope.FormData = window.FormData;
  return window;
}

function installForeignElementConstructors(): void {
  const foreignWindow = new HappyWindow();
  const globalScope = globalThis as unknown as {
    Element: unknown;
    HTMLFormElement: unknown;
  };
  globalScope.Element = foreignWindow.Element;
  globalScope.HTMLFormElement = foreignWindow.HTMLFormElement;
}

function html(body: string): Response {
  return new Response(`<!doctype html><html><body>${body}</body></html>`, {
    headers: {
      'content-type': 'text/html; charset=utf-8'
    }
  });
}

function clickFrameElement(window: HappyWindow, frame: HTMLIFrameElement, selector: string): void {
  const element = frame.contentDocument?.querySelector(selector);
  if (!element) {
    throw new Error(`Missing frame element: ${selector}`);
  }
  element.dispatchEvent(new window.MouseEvent('click', {
    bubbles: true,
    cancelable: true
  }) as unknown as Event);
}

function submitFrameForm(window: HappyWindow, frame: HTMLIFrameElement, selector: string): void {
  const form = frame.contentDocument?.querySelector(selector);
  if (!form) {
    throw new Error(`Missing frame form: ${selector}`);
  }
  form.dispatchEvent(new window.Event('submit', {
    bubbles: true,
    cancelable: true
  }) as unknown as Event);
}

function nextTask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
