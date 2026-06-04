import { createWebRuntime } from '../core/create-web-runtime.ts';
import { createWebRuntimeApp } from '../core/define-runtime.ts';
import {
  cacheFirst,
  get,
  middleware,
  mount,
  redirect,
  toApp
} from '../core/routes.ts';
import type {
  FetchApp,
  WebRuntime,
  WebRuntimeAppDefinition,
  WebRuntimeCreateOptions,
  WebRuntimeTraceEntry
} from '../core/types.ts';
import { cdnEdgeCacheBackendApp } from '../examples/cdn-edge-cache/backend.ts';
import { cdnEdgeCacheFrontendApp } from '../examples/cdn-edge-cache/frontend.ts';
import { edgeMiddlewareBackendApp } from '../examples/edge-middleware/backend.ts';
import { edgeMiddlewareFrontendApp } from '../examples/edge-middleware/frontend.ts';
import { helloApp } from '../examples/hello-app/manifest.ts';
import { multiAppNetworkApiApp } from '../examples/multi-app-network/api.ts';
import { multiAppNetworkFrontendApp } from '../examples/multi-app-network/frontend.ts';
import { platformFetchChainBackendApp } from '../examples/platform-fetch-chain/backend.ts';
import { platformFetchChainFrontendApp } from '../examples/platform-fetch-chain/frontend.ts';
import { requestBodyLabBackendApp } from '../examples/request-body-lab/backend.ts';
import { requestBodyLabFrontendApp } from '../examples/request-body-lab/frontend.ts';
import { serviceWorkerCacheBackendApp } from '../examples/service-worker-cache/backend.ts';
import { serviceWorkerCacheFrontendApp } from '../examples/service-worker-cache/frontend.ts';
import { simpleBackendApp } from '../examples/simple-fullstack/backend.ts';
import { simpleFrontendApp } from '../examples/simple-fullstack/frontend.ts';
import { statefulSessionCacheBackendApp } from '../examples/stateful-session-cache/backend.ts';
import { statefulSessionCacheFrontendApp } from '../examples/stateful-session-cache/frontend.ts';
import { streamingApp } from '../examples/streaming-app/manifest.ts';

type RuntimeMode = 'same-realm' | 'backend-iframe' | 'two-iframes';

const interceptedFrameDocuments = new WeakSet<Document>();
const executedFrameScriptText = new WeakMap<Document, Set<string>>();

export async function bootBrowserShell(root: Document = document, initialPath = '/'): Promise<WebRuntime> {
  const frame = requireElement<HTMLIFrameElement>(root, '#preview');
  const runtimeMode = requireElement<HTMLSelectElement>(root, '#runtime-mode');
  const urlInput = requireElement<HTMLInputElement>(root, '#fake-url');
  const terminalInput = requireElement<HTMLInputElement>(root, '#terminal-command');
  const terminalOutput = requireElement<HTMLElement>(root, '#terminal-output');
  const traceOutput = requireElement<HTMLElement>(root, '#trace-output');
  const cacheOutput = requireElement<HTMLElement>(root, '#cache-output');
  const status = requireElement<HTMLElement>(root, '#status');
  const streamStatus = root.querySelector<HTMLElement>('#stream-status') ?? undefined;

  let web = await createWeb(runtimeMode.value as RuntimeMode);
  let renderGeneration = 0;
  let activeRenderController: AbortController | undefined;

  function syncFakeUrl(): void {
    urlInput.value = `${web.location.pathname}${web.location.search}${web.location.hash}`;
  }

  function startRenderJob(): { generation: number; signal: AbortSignal } {
    activeRenderController?.abort();
    activeRenderController = new AbortController();
    renderGeneration += 1;
    return {
      generation: renderGeneration,
      signal: activeRenderController.signal
    };
  }

  function isCurrentRender(generation: number): boolean {
    return generation === renderGeneration;
  }

  async function renderNavigation(loadResponse: () => Promise<Response>): Promise<void> {
    const job = startRenderJob();
    const response = await loadResponse();
    if (!isCurrentRender(job.generation) || job.signal.aborted) {
      await cancelResponseBody(response);
      return;
    }
    syncFakeUrl();
    status.textContent = `${response.status} receiving`;
    const rendered = await renderFrame(frame, web, response, navigate, streamStatus, job.signal);
    if (!rendered || !isCurrentRender(job.generation) || job.signal.aborted) {
      return;
    }
    status.textContent = `${response.status} ${response.statusText || 'OK'}`;
    await renderPanels();
  }

  async function navigate(url: string): Promise<void> {
    await renderNavigation(() => web.navigate(url));
  }

  async function renderPanels(): Promise<void> {
    traceOutput.textContent = formatTraceEntries(web.trace.entries().slice(-32));
    const keys = await web.edge.cache.keys();
    cacheOutput.textContent = keys.length === 0
      ? 'No edge cache entries'
      : keys.map((entry) => `${entry.status} ${new URL(entry.url).pathname} ${entry.tags.join(',')}`).join('\n');
    terminalOutput.textContent = web.terminal.output();
  }

  web.trace.subscribe(() => {
    void renderPanels();
  });
  web.terminal.subscribe(() => {
    void renderPanels();
  });

  root.querySelector('[data-action="back"]')?.addEventListener('click', async () => {
    web.history.back();
    await renderNavigation(() => web.reload());
  });
  root.querySelector('[data-action="forward"]')?.addEventListener('click', async () => {
    web.history.forward();
    await renderNavigation(() => web.reload());
  });
  root.querySelector('[data-action="reload"]')?.addEventListener('click', async () => {
    await renderNavigation(() => web.reload());
  });
  root.querySelector('[data-action="run"]')?.addEventListener('click', async () => {
    await navigate(urlInput.value || '/');
  });
  root.querySelector('[data-action="reset"]')?.addEventListener('click', async () => {
    activeRenderController?.abort();
    web = await createWeb(runtimeMode.value as RuntimeMode);
    await navigate(initialPath);
  });
  runtimeMode.addEventListener('change', async () => {
    activeRenderController?.abort();
    web = await createWeb(runtimeMode.value as RuntimeMode);
    await navigate(urlInput.value || '/');
  });
  root.querySelector('[data-action="purge"]')?.addEventListener('click', async () => {
    await web.edge.cache.purgeAll();
    await renderPanels();
  });
  root.querySelector('#terminal-run')?.addEventListener('click', async () => {
    await web.terminal.run(terminalInput.value);
    terminalInput.value = '';
    await renderPanels();
  });
  terminalInput.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      await web.terminal.run(terminalInput.value);
      terminalInput.value = '';
      await renderPanels();
    }
  });
  urlInput.addEventListener('keydown', async (event) => {
    if (event.key === 'Enter') {
      await navigate(urlInput.value || '/');
    }
  });
  root.addEventListener('dblclick', (event) => {
    event.preventDefault();
  });

  await web.terminal.run('npm install');
  await web.terminal.run('npm run dev');
  await navigate(initialPath);
  return web;
}

function formatTraceEntries(entries: WebRuntimeTraceEntry[]): string {
  const lines: string[] = [];
  let hasSeenCycle = false;

  for (const entry of entries) {
    if (entry.boundary === 'frontend:request') {
      if (hasSeenCycle) {
        lines.push('---------------- new request/response cycle ----------------');
      }
      hasSeenCycle = true;
    }
    lines.push(`${entry.boundary} ${entry.status ?? ''} ${new URL(entry.url).pathname}`);
  }

  return lines.join('\n');
}

async function createWeb(mode: RuntimeMode): Promise<WebRuntime> {
  return createWebRuntime(browserShellWebRuntime, runtimeOptions(mode));
}

function runtimeOptions(mode: RuntimeMode): WebRuntimeCreateOptions {
  if (mode === 'backend-iframe') {
    return {
      runtimes: {
        backend: {
          mode: 'iframe',
          sandbox: 'allow-scripts'
        }
      }
    };
  }
  if (mode === 'two-iframes') {
    return {
      runtimes: {
        frontend: {
          mode: 'iframe',
          sandbox: 'allow-scripts'
        },
        backend: {
          mode: 'iframe',
          sandbox: 'allow-scripts'
        }
      }
    };
  }
  return {};
}

async function renderFrame(
  frame: HTMLIFrameElement,
  web: WebRuntime,
  response: Response,
  navigate: (url: string) => Promise<void>,
  streamStatus: HTMLElement | undefined,
  signal: AbortSignal
): Promise<boolean> {
  const contentType = response.headers.get('content-type') ?? '';
  const installInterceptors = (): void => {
    if (signal.aborted) {
      return;
    }
    installFrameInterceptors(frame, web, navigate);
  };
  frame.addEventListener('load', installInterceptors, {
    once: true
  });
  if (signal.aborted) {
    return false;
  }
  if (contentType.includes('text/html')) {
    if (!await renderHtmlFrame(frame, response, installInterceptors, streamStatus, signal)) {
      return false;
    }
  } else if (response.headers.get('x-web-runtime-stream') === '1' && response.body) {
    if (!await renderTextFrame(frame, response, installInterceptors, streamStatus, contentType, signal)) {
      return false;
    }
  } else {
    const body = await response.text();
    if (signal.aborted) {
      return false;
    }
    hideStreamStatus(streamStatus);
    frame.srcdoc = prepareFrameHtml(`<!doctype html><html><body><pre>${escapeHtml(body)}</pre></body></html>`);
  }
  if (signal.aborted) {
    return false;
  }
  installInterceptors();
  setTimeout(() => {
    if (!signal.aborted) {
      installInterceptors();
    }
  }, 0);
  return true;
}

async function renderHtmlFrame(
  frame: HTMLIFrameElement,
  response: Response,
  installInterceptors: () => void,
  streamStatus: HTMLElement | undefined,
  signal: AbortSignal
): Promise<boolean> {
  if (response.headers.get('x-web-runtime-stream') !== '1' || !response.body) {
    const html = await response.text();
    if (signal.aborted) {
      return false;
    }
    hideStreamStatus(streamStatus);
    frame.srcdoc = prepareFrameHtml(html);
    return true;
  }

  const reader = response.body.getReader();
  const removeAbortListener = cancelReaderOnAbort(reader, signal);
  const decoder = new TextDecoder();
  let html = '';
  let chunkCount = 0;
  let byteCount = 0;
  const startedAt = performance.now();
  updateStreamStatus(streamStatus, {
    state: 'waiting',
    contentType: response.headers.get('content-type') ?? 'text/html',
    chunkCount,
    byteCount,
    elapsedMs: 0,
    latest: 'waiting for first HTML chunk'
  });

  try {
    while (true) {
      if (signal.aborted) {
        return false;
      }
      const result = await reader.read();
      if (signal.aborted) {
        return false;
      }
      if (result.done) {
        const tail = decoder.decode();
        if (tail) {
          html += tail;
        }
        break;
      }
      const chunkText = decoder.decode(result.value, {
        stream: true
      });
      html += chunkText;
      chunkCount += 1;
      byteCount += result.value.byteLength;
      updateStreamStatus(streamStatus, {
        state: 'streaming',
        contentType: response.headers.get('content-type') ?? 'text/html',
        chunkCount,
        byteCount,
        elapsedMs: performance.now() - startedAt,
        latest: previewChunk(chunkText, 'html')
      });
      if (chunkCount === 1 || !appendStreamingHtmlChunk(frame, chunkText, installInterceptors)) {
        writeFrameHtml(frame, html, installInterceptors);
      }
      dispatchFrameStreamUpdate(frame, {
        chunkCount,
        byteCount,
        elapsedMs: performance.now() - startedAt,
        complete: false
      });
    }
  } finally {
    removeAbortListener();
  }

  if (signal.aborted) {
    return false;
  }

  updateStreamStatus(streamStatus, {
    state: 'complete',
    contentType: response.headers.get('content-type') ?? 'text/html',
    chunkCount,
    byteCount,
    elapsedMs: performance.now() - startedAt,
    latest: 'complete HTML document rendered'
  });
  frame.addEventListener('load', installInterceptors, {
    once: true
  });
  installInterceptors();
  dispatchFrameStreamUpdate(frame, {
    chunkCount,
    byteCount,
    elapsedMs: performance.now() - startedAt,
    complete: true
  });
  return true;
}

async function renderTextFrame(
  frame: HTMLIFrameElement,
  response: Response,
  installInterceptors: () => void,
  streamStatus: HTMLElement | undefined,
  contentType: string,
  signal: AbortSignal
): Promise<boolean> {
  if (!response.body) {
    const text = await response.text();
    if (signal.aborted) {
      return false;
    }
    hideStreamStatus(streamStatus);
    frame.srcdoc = prepareFrameHtml(`<!doctype html><html><body><pre>${escapeHtml(text)}</pre></body></html>`);
    return true;
  }

  const reader = response.body.getReader();
  const removeAbortListener = cancelReaderOnAbort(reader, signal);
  const decoder = new TextDecoder();
  let text = '';
  let chunkCount = 0;
  let byteCount = 0;
  const startedAt = performance.now();
  updateStreamStatus(streamStatus, {
    state: 'waiting',
    contentType,
    chunkCount,
    byteCount,
    elapsedMs: 0,
    latest: 'waiting for first text chunk'
  });

  try {
    while (true) {
      if (signal.aborted) {
        return false;
      }
      const result = await reader.read();
      if (signal.aborted) {
        return false;
      }
      if (result.done) {
        const tail = decoder.decode();
        if (tail) {
          text += tail;
        }
        break;
      }
      const chunkText = decoder.decode(result.value, {
        stream: true
      });
      text += chunkText;
      chunkCount += 1;
      byteCount += result.value.byteLength;
      updateStreamStatus(streamStatus, {
        state: 'streaming',
        contentType,
        chunkCount,
        byteCount,
        elapsedMs: performance.now() - startedAt,
        latest: previewChunk(chunkText, 'text')
      });
      writeFramePreText(frame, text, installInterceptors);
    }
  } finally {
    removeAbortListener();
  }

  if (signal.aborted) {
    return false;
  }

  updateStreamStatus(streamStatus, {
    state: 'complete',
    contentType,
    chunkCount,
    byteCount,
    elapsedMs: performance.now() - startedAt,
    latest: 'complete text response rendered'
  });
  frame.addEventListener('load', installInterceptors, {
    once: true
  });
  writeFramePreText(frame, text, installInterceptors);
  return true;
}

interface FrameScrollPosition {
  x: number;
  y: number;
}

interface FrameStreamUpdateDetail {
  chunkCount: number;
  byteCount: number;
  elapsedMs: number;
  complete: boolean;
}

async function cancelResponseBody(response: Response): Promise<void> {
  if (!response.body) {
    return;
  }
  try {
    await response.body.cancel();
  } catch {
    // The body may already be locked or closed by the active render job.
  }
}

function cancelReaderOnAbort<T>(
  reader: ReadableStreamDefaultReader<T>,
  signal: AbortSignal
): () => void {
  const cancel = (): void => {
    void reader.cancel().catch(() => {
      return;
    });
  };
  if (signal.aborted) {
    cancel();
    return () => {
      return;
    };
  }
  signal.addEventListener('abort', cancel, {
    once: true
  });
  return () => {
    signal.removeEventListener('abort', cancel);
  };
}

function writeFrameHtml(
  frame: HTMLIFrameElement,
  html: string,
  installInterceptors: () => void
): void {
  const preparedHtml = prepareFrameHtml(html);
  const frameDocument = frame.contentDocument;
  const Parser = frame.ownerDocument.defaultView?.DOMParser ?? globalThis.DOMParser;
  if (!frameDocument?.documentElement || !frameDocument.body || !Parser) {
    frame.addEventListener('load', installInterceptors, {
      once: true
    });
    frame.srcdoc = preparedHtml;
    return;
  }

  const scroll = readFrameScroll(frame);
  const parsed = new Parser().parseFromString(preparedHtml, 'text/html');
  frameDocument.head.innerHTML = parsed.head.innerHTML;
  frameDocument.body.innerHTML = parsed.body.innerHTML;
  runFrameInlineScripts(frameDocument);
  restoreFrameScroll(frame, scroll);
  installInterceptors();
}

function appendStreamingHtmlChunk(
  frame: HTMLIFrameElement,
  chunk: string,
  installInterceptors: () => void
): boolean {
  const frameDocument = frame.contentDocument;
  if (!frameDocument?.documentElement || !frameDocument.body) {
    return false;
  }

  const streamList = frameDocument.querySelector('.stream-list');
  const main = frameDocument.querySelector('main') ?? frameDocument.body;
  if (!streamList && !main) {
    return false;
  }

  const template = frameDocument.createElement('template');
  template.innerHTML = chunk;
  const nodes = Array.from(template.content.childNodes).filter((node) => {
    return node.nodeType !== 3 || (node.textContent ?? '').trim() !== '';
  });
  if (nodes.length === 0) {
    return true;
  }

  const scroll = readFrameScroll(frame);
  for (const node of nodes) {
    if (node.nodeType === 1 && (node as Element).tagName.toLowerCase() === 'article' && streamList) {
      streamList.append(node);
    } else {
      main.append(node);
    }
  }
  restoreFrameScroll(frame, scroll);
  installInterceptors();
  return true;
}

function writeFramePreText(
  frame: HTMLIFrameElement,
  text: string,
  installInterceptors: () => void
): void {
  const frameDocument = frame.contentDocument;
  if (!frameDocument?.documentElement || !frameDocument.body) {
    frame.addEventListener('load', installInterceptors, {
      once: true
    });
    frame.srcdoc = prepareFrameHtml(`<!doctype html><html><body><pre>${escapeHtml(text)}</pre></body></html>`);
    return;
  }

  const scroll = readFrameScroll(frame);
  let pre = frameDocument.querySelector('pre');
  if (!pre) {
    frameDocument.head.innerHTML = '<meta name="viewport" content="width=device-width, initial-scale=1">';
    frameDocument.body.innerHTML = '<pre></pre>';
    pre = frameDocument.querySelector('pre');
  }
  if (pre) {
    pre.textContent = text;
  }
  restoreFrameScroll(frame, scroll);
  installInterceptors();
}

function readFrameScroll(frame: HTMLIFrameElement): FrameScrollPosition {
  const frameWindow = frame.contentWindow;
  return {
    x: frameWindow?.scrollX ?? 0,
    y: frameWindow?.scrollY ?? 0
  };
}

function restoreFrameScroll(frame: HTMLIFrameElement, position: FrameScrollPosition): void {
  frame.contentWindow?.scrollTo(position.x, position.y);
  frame.ownerDocument.defaultView?.setTimeout(() => {
    frame.contentWindow?.scrollTo(position.x, position.y);
  }, 0);
}

function runFrameInlineScripts(frameDocument: Document): void {
  const scripts = Array.from(frameDocument.querySelectorAll('script:not([src])'));
  if (scripts.length === 0) {
    return;
  }
  let executed = executedFrameScriptText.get(frameDocument);
  if (!executed) {
    executed = new Set<string>();
    executedFrameScriptText.set(frameDocument, executed);
  }

  for (const script of scripts) {
    const text = script.textContent ?? '';
    if (text.trim() === '' || executed.has(text)) {
      continue;
    }
    executed.add(text);
    const runnableScript = frameDocument.createElement('script');
    runnableScript.textContent = text;
    script.replaceWith(runnableScript);
  }
}

function dispatchFrameStreamUpdate(frame: HTMLIFrameElement, detail: FrameStreamUpdateDetail): void {
  const frameDocument = frame.contentDocument;
  const EventConstructor = frameDocument?.defaultView?.CustomEvent ?? globalThis.CustomEvent;
  if (!frameDocument || !EventConstructor) {
    return;
  }
  frameDocument.dispatchEvent(new EventConstructor('webruntime:stream-chunk', {
    detail
  }));
}

interface StreamStatusState {
  state: 'waiting' | 'streaming' | 'complete';
  contentType: string;
  chunkCount: number;
  byteCount: number;
  elapsedMs: number;
  latest: string;
}

function updateStreamStatus(element: HTMLElement | undefined, state: StreamStatusState): void {
  if (!element) {
    return;
  }
  element.hidden = false;
  element.classList.toggle('is-complete', state.state === 'complete');
  const label = state.state === 'complete'
    ? 'Stream complete'
    : state.state === 'waiting'
      ? 'Waiting for first chunk'
      : 'Streaming chunks';
  element.innerHTML = `
    <div class="stream-status__top">
      <span class="stream-status__label">${label}</span>
      <span class="stream-status__pill">${escapeHtml(formatElapsed(state.elapsedMs))}</span>
    </div>
    <div class="stream-status__bar" aria-hidden="true"></div>
    <div class="stream-status__meta">
      <span>${state.chunkCount} chunks</span>
      <span>${formatBytes(state.byteCount)}</span>
      <span>${escapeHtml(state.contentType.split(';')[0] || 'stream')}</span>
    </div>
    <pre class="stream-status__latest">${escapeHtml(state.latest)}</pre>
  `;
}

function hideStreamStatus(element: HTMLElement | undefined): void {
  if (!element) {
    return;
  }
  element.hidden = true;
  element.classList.remove('is-complete');
  element.textContent = '';
}

function previewChunk(chunk: string, mode: 'html' | 'text'): string {
  const text = mode === 'html'
    ? chunk
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
    : chunk;
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return mode === 'html' ? '[html shell chunk]' : '[empty chunk]';
  }
  return normalized.length > 260 ? `${normalized.slice(0, 260)}...` : normalized;
}

function formatElapsed(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export interface ExampleDirectoryCard {
  title: string;
  href: string;
  summary: string;
  setup: {
    apps: string;
    runtime: string;
    routes: string;
    behavior: string;
  };
}

export const exampleDirectoryCards: ExampleDirectoryCard[] = [
  {
    title: 'Hello App',
    href: '/examples/hello-app/',
    summary: 'The original manifest app served through WebRuntime.',
    setup: {
      apps: 'one fetch app from the manifest',
      runtime: 'backend app mounted behind the shell',
      routes: '/, /about, /api/time',
      behavior: 'baseline Request -> Response flow'
    }
  },
  {
    title: 'Streaming App',
    href: '/examples/streaming-app/',
    summary: 'Long streamed HTML, text, and NDJSON responses.',
    setup: {
      apps: 'one streaming fetch app',
      runtime: 'backend app with stream helpers',
      routes: '/, /events, /long.txt',
      behavior: 'HTML updates as stream chunks arrive'
    }
  },
  {
    title: 'Simple Fullstack',
    href: '/examples/simple-fullstack/',
    summary: 'Frontend and backend apps talking through routes.',
    setup: {
      apps: 'frontend app plus backend app',
      runtime: 'same realm by default; iframe presets available',
      routes: '/examples/simple-fullstack/* and /api/*',
      behavior: 'browser code fetches backend routes through WebRuntime'
    }
  },
  {
    title: 'Service Worker Cache',
    href: '/examples/service-worker-cache/',
    summary: 'Service-worker-style cache storage in front of an API.',
    setup: {
      apps: 'frontend app plus backend API',
      runtime: 'same-realm platform cache',
      routes: '/examples/service-worker-cache/api/*',
      behavior: 'cacheFirst with the service-worker cache store'
    }
  },
  {
    title: 'CDN Edge Cache',
    href: '/examples/cdn-edge-cache/',
    summary: 'Shared edge cache with tags and traceable hits.',
    setup: {
      apps: 'frontend app plus backend API',
      runtime: 'same-realm edge cache store',
      routes: '/examples/cdn-edge-cache/api/*',
      behavior: 'cacheFirst with ttl and cache tags'
    }
  },
  {
    title: 'Edge Middleware',
    href: '/examples/edge-middleware/',
    summary: 'Redirect, rewrite, and HTML transform middleware.',
    setup: {
      apps: 'frontend app plus edge/backend routes',
      runtime: 'middleware chain before the final app',
      routes: '/old, /new, /docs',
      behavior: 'redirects, rewrites, and injects response HTML'
    }
  },
  {
    title: 'Multi-App Network',
    href: '/examples/multi-app-network/',
    summary: 'A frontend app connected to a separate API app.',
    setup: {
      apps: 'web app plus api.local app',
      runtime: 'same-realm apps with host-aware routing',
      routes: '/examples/multi-app-network/* and https://api.local/*',
      behavior: 'WebRuntime dispatches across registered app origins'
    }
  },
  {
    title: 'Platform Fetch Chain',
    href: '/examples/platform-fetch-chain/',
    summary: 'Backend code calls another backend route through platform.fetch().',
    setup: {
      apps: 'frontend app plus backend app',
      runtime: 'backend platform fetch is scoped to WebRuntime',
      routes: '/api/outer -> /api/inner',
      behavior: 'internal fetch stays inside the route graph'
    }
  },
  {
    title: 'Request Body Lab',
    href: '/examples/request-body-lab/',
    summary: 'POST body preservation and method-aware routing.',
    setup: {
      apps: 'frontend form app plus echo backend',
      runtime: 'same-realm request body pass-through',
      routes: '/api/echo',
      behavior: 'request bodies are not consumed by proxy layers'
    }
  },
  {
    title: 'Stateful Session Cache',
    href: '/examples/stateful-session-cache/',
    summary: 'Scoped cookies and named Cache Storage.',
    setup: {
      apps: 'frontend app plus stateful backend',
      runtime: 'backend platform owns cookies and named caches',
      routes: '/api/session, /api/cache',
      behavior: 'state is scoped to the WebRuntime app platform'
    }
  }
];

function renderExampleDirectoryCard(card: ExampleDirectoryCard): string {
  return `<a class="example-card" href="${escapeHtml(card.href)}">
              <span class="example-card__top">
                <strong>${escapeHtml(card.title)}</strong>
                <span class="example-card__cta">Open demo</span>
              </span>
              <span class="example-card__summary">${escapeHtml(card.summary)}</span>
              <span class="example-card__path">${escapeHtml(card.href)}</span>
              <span class="setup-grid" aria-label="${escapeHtml(card.title)} setup">
                <span><b>Apps</b>${escapeHtml(card.setup.apps)}</span>
                <span><b>Runtime</b>${escapeHtml(card.setup.runtime)}</span>
                <span><b>Routes</b>${escapeHtml(card.setup.routes)}</span>
                <span><b>Behavior</b>${escapeHtml(card.setup.behavior)}</span>
              </span>
            </a>`;
}

const directoryApp: FetchApp = {
  async fetch() {
    return new Response(`<!doctype html>
      <html>
        <head>
          <title>WebRuntime Examples</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            :root {
              color: #172033;
              font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              background: #f6f8fb;
            }
            body {
              margin: 0;
              padding: 28px;
            }
            html,
            body,
            a,
            button,
            input,
            select {
              touch-action: manipulation;
            }
            h1 {
              margin: 0 0 8px;
              font-size: 30px;
            }
            p {
              max-width: 760px;
              margin: 0 0 22px;
              color: #516176;
              line-height: 1.5;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
              gap: 16px;
            }
            .example-card {
              display: flex;
              flex-direction: column;
              gap: 12px;
              min-height: 292px;
              padding: 18px;
              border: 1px solid #c8d3e3;
              border-radius: 8px;
              color: inherit;
              text-decoration: none;
              background: #ffffff;
            }
            .example-card:hover {
              border-color: #7184a0;
              background: #f9fbfe;
            }
            .example-card__top {
              display: flex;
              justify-content: space-between;
              gap: 12px;
              align-items: start;
            }
            strong {
              display: block;
              font-size: 17px;
            }
            .example-card__summary {
              display: block;
              color: #516176;
              line-height: 1.45;
            }
            .example-card__path {
              display: inline-block;
              width: fit-content;
              border: 1px solid #d9e1ee;
              border-radius: 6px;
              padding: 5px 7px;
              background: #f6f8fb;
              color: #263347;
              font: 12px/1.3 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            }
            .example-card__cta {
              flex: 0 0 auto;
              border: 1px solid #172033;
              border-radius: 6px;
              padding: 5px 8px;
              background: #172033;
              color: #ffffff;
              font-size: 12px;
            }
            .setup-grid {
              display: grid;
              gap: 8px;
              margin-top: auto;
              color: #516176;
              font-size: 13px;
              line-height: 1.35;
            }
            .setup-grid span {
              display: grid;
              grid-template-columns: 72px minmax(0, 1fr);
              gap: 8px;
            }
            .setup-grid b {
              color: #263347;
              font-weight: 700;
            }
            @media (max-width: 560px) {
              body {
                padding: 18px;
              }
              .grid {
                grid-template-columns: 1fr;
              }
              .example-card {
                min-height: 0;
              }
              .example-card__top {
                display: grid;
              }
              .example-card__cta {
                width: fit-content;
              }
            }
          </style>
        </head>
        <body>
          <h1>WebRuntime Examples</h1>
          <p>Each demo opens into its own route. The card shows the app wiring, runtime mode, routes, and proxy behavior before you jump in.</p>
          <div class="grid">
            ${exampleDirectoryCards.map(renderExampleDirectoryCard).join('\n')}
          </div>
        </body>
      </html>`, {
      headers: {
        'content-type': 'text/html; charset=utf-8'
      }
    });
  }
};

const browserShellWebRuntime: WebRuntimeAppDefinition = createWebRuntimeApp({
  origin: 'https://webruntime.local',
  apps: {
    directory: {
      app: directoryApp,
      runtime: 'frontend',
      basePath: '/'
    },
    helloExample: {
      app: helloApp.app,
      runtime: 'backend',
      basePath: '/examples/hello-app/'
    },
    streamingExample: {
      app: streamingApp.app,
      runtime: 'backend',
      basePath: '/examples/streaming-app/'
    },
    simpleFrontend: {
      app: simpleFrontendApp,
      runtime: 'frontend',
      basePath: '/examples/simple-fullstack/'
    },
    simpleBackend: {
      app: simpleBackendApp,
      runtime: 'backend',
      basePath: '/examples/simple-fullstack/api/'
    },
    serviceWorkerCacheFrontend: {
      app: serviceWorkerCacheFrontendApp,
      runtime: 'frontend',
      basePath: '/examples/service-worker-cache/'
    },
    serviceWorkerCacheBackend: {
      app: serviceWorkerCacheBackendApp,
      runtime: 'backend',
      basePath: '/examples/service-worker-cache/api/'
    },
    cdnEdgeCacheFrontend: {
      app: cdnEdgeCacheFrontendApp,
      runtime: 'frontend',
      basePath: '/examples/cdn-edge-cache/'
    },
    cdnEdgeCacheBackend: {
      app: cdnEdgeCacheBackendApp,
      runtime: 'backend',
      basePath: '/examples/cdn-edge-cache/api/'
    },
    edgeMiddlewareFrontend: {
      app: edgeMiddlewareFrontendApp,
      runtime: 'frontend',
      basePath: '/examples/edge-middleware/'
    },
    edgeMiddlewareBackend: {
      app: edgeMiddlewareBackendApp,
      runtime: 'backend',
      basePath: '/examples/edge-middleware/'
    },
    multiAppNetworkFrontend: {
      app: multiAppNetworkFrontendApp,
      runtime: 'frontend',
      basePath: '/examples/multi-app-network/'
    },
    multiAppNetworkApi: {
      app: multiAppNetworkApiApp,
      runtime: 'backend',
      baseUrl: 'https://api.local/'
    },
    platformFetchChainFrontend: {
      app: platformFetchChainFrontendApp,
      runtime: 'frontend',
      basePath: '/examples/platform-fetch-chain/'
    },
    platformFetchChainBackend: {
      app: platformFetchChainBackendApp,
      runtime: 'backend',
      basePath: '/examples/platform-fetch-chain/api/'
    },
    requestBodyLabFrontend: {
      app: requestBodyLabFrontendApp,
      runtime: 'frontend',
      basePath: '/examples/request-body-lab/'
    },
    requestBodyLabBackend: {
      app: requestBodyLabBackendApp,
      runtime: 'backend',
      basePath: '/examples/request-body-lab/api/'
    },
    statefulSessionCacheFrontend: {
      app: statefulSessionCacheFrontendApp,
      runtime: 'frontend',
      basePath: '/examples/stateful-session-cache/'
    },
    statefulSessionCacheBackend: {
      app: statefulSessionCacheBackendApp,
      runtime: 'backend',
      basePath: '/examples/stateful-session-cache/api/'
    }
  },
  routes: [
    get('/', toApp('directory')),
    get('/examples', redirect('/', 302)),
    mount('/examples/hello-app', toApp('helloExample')),
    mount('/examples/streaming-app', toApp('streamingExample')),
    mount('/examples/simple-fullstack/api', toApp('simpleBackend')),
    mount('/examples/simple-fullstack', toApp('simpleFrontend')),
    mount('/examples/service-worker-cache/api', [
      cacheFirst({
        store: 'service-worker'
      }),
      toApp('serviceWorkerCacheBackend')
    ]),
    mount('/examples/service-worker-cache', toApp('serviceWorkerCacheFrontend')),
    mount('/examples/cdn-edge-cache/api', [
      cacheFirst({
        store: 'edge',
        ttl: 60,
        tags: ['api']
      }),
      toApp('cdnEdgeCacheBackend')
    ]),
    mount('/examples/cdn-edge-cache', toApp('cdnEdgeCacheFrontend')),
    get('/examples/edge-middleware/old', redirect('/examples/edge-middleware/new', 302)),
    mount('/examples/edge-middleware', [
      middleware(() => true, async (_request, _context, next) => {
        const response = await next();
        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.includes('text/html')) {
          return response;
        }
        const html = await response.text();
        return new Response(html.replace('</head>', '<meta name="edge" content="middleware"></head>'), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      }),
      middleware((_request, url) => url.pathname === '/docs', (request, _context, next) => {
        const rewriteUrl = new URL(request.url);
        rewriteUrl.pathname = '/docs/index';
        return next(new Request(rewriteUrl, request));
      }),
      middleware((_request, url) => url.pathname === '/' || url.pathname === '/index.html', toApp('edgeMiddlewareFrontend')),
      toApp('edgeMiddlewareBackend')
    ]),
    mount('/examples/multi-app-network/api', toApp('multiAppNetworkApi')),
    mount('/examples/multi-app-network', toApp('multiAppNetworkFrontend')),
    middleware((_request, url) => url.origin === 'https://api.local', toApp('multiAppNetworkApi')),
    mount('/examples/platform-fetch-chain/api', toApp('platformFetchChainBackend')),
    mount('/examples/platform-fetch-chain', toApp('platformFetchChainFrontend')),
    mount('/examples/request-body-lab/api', toApp('requestBodyLabBackend')),
    mount('/examples/request-body-lab', toApp('requestBodyLabFrontend')),
    mount('/examples/stateful-session-cache/api', toApp('statefulSessionCacheBackend')),
    mount('/examples/stateful-session-cache', toApp('statefulSessionCacheFrontend')),
    toApp('directory')
  ]
});

function prepareFrameHtml(html: string): string {
  const mobileGuards = `
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      html,
      body,
      a,
      button,
      input,
      select,
      textarea {
        touch-action: manipulation;
      }
    </style>
  `;
  const interactionGuard = `
    <script>
      document.addEventListener('dblclick', function (event) {
        event.preventDefault();
      }, { passive: false });
    </script>
  `;
  if (html.includes('</head>')) {
    return html.replace('</head>', `${mobileGuards}</head>`).replace('</body>', `${interactionGuard}</body>`);
  }
  return `<!doctype html><html><head>${mobileGuards}</head><body>${html}${interactionGuard}</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isDomElement(value: EventTarget | null): value is Element {
  return typeof value === 'object'
    && value !== null
    && 'nodeType' in value
    && value.nodeType === 1
    && 'closest' in value
    && typeof value.closest === 'function';
}

function installFrameInterceptors(
  frame: HTMLIFrameElement,
  web: WebRuntime,
  navigate: (url: string) => Promise<void>
): void {
  const frameDocument = frame.contentDocument;
  if (!frameDocument) {
    return;
  }
  if (interceptedFrameDocuments.has(frameDocument)) {
    return;
  }
  interceptedFrameDocuments.add(frameDocument);

  frameDocument.addEventListener('click', (event) => {
    const target = event.target;
    if (!isDomElement(target)) {
      return;
    }
    const anchor = target.closest('a[href]');
    if (!anchor) {
      return;
    }
    const href = anchor.getAttribute('href');
    if (!href) {
      return;
    }
    const targetUrl = new URL(href, web.location.href);
    if (targetUrl.origin !== web.location.origin) {
      return;
    }
    event.preventDefault();
    void navigate(resolveExampleHref(web.location.pathname, href, targetUrl));
  });
}

function resolveExampleHref(currentPathname: string, href: string, targetUrl: URL): string {
  if (!href.startsWith('/') || href.startsWith('/examples/')) {
    return `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
  }
  const match = currentPathname.match(/^\/examples\/[^/]+/);
  if (!match) {
    return `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
  }
  return `${match[0]}${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
}

function requireElement<T extends Element>(root: Document, selector: string): T {
  const element = root.querySelector(selector);
  if (!element) {
    throw new Error(`Missing WebRuntime shell element: ${selector}`);
  }
  return element as T;
}
