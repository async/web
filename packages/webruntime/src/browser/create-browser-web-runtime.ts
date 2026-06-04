import { createWebRuntime } from '../core/create-web-runtime.ts';
import type {
  BrowserFrameStreamingMode,
  WebRuntime,
  WebRuntimeConfig,
  WebRuntimeFrontendRuntime
} from '../core/types.ts';

export interface BrowserFrameFrontend extends WebRuntimeFrontendRuntime {
  readonly kind: 'browser-frame';
  readonly frame: HTMLIFrameElement;
  readonly streaming: BrowserFrameStreamingMode;
  render(response: Response): Promise<void>;
}

export type BrowserWebRuntime = Omit<WebRuntime, 'frontend' | 'navigate' | 'reload'> & {
  readonly frontend: BrowserFrameFrontend;
  navigate(url: string): Promise<Response>;
  reload(): Promise<Response>;
};

const interceptedFrameDocuments = new WeakSet<Document>();

export async function createBrowserWebRuntime(config: WebRuntimeConfig): Promise<BrowserWebRuntime> {
  if (config.pipeline.frontend.kind !== 'browser-frame') {
    throw new Error('createBrowserWebRuntime requires frontend.kind = "browser-frame"');
  }

  const baseWeb = await createWebRuntime(config);
  const frontend = createBrowserFrameFrontend(baseWeb, {
    frame: config.pipeline.frontend.frame,
    streaming: config.pipeline.frontend.streaming ?? 'buffer',
    syncRealUrl: config.ui?.syncRealUrl ?? false,
    realUrlBasePath: config.ui?.realUrlBasePath ?? ''
  });

  return {
    ...baseWeb,
    frontend,
    async navigate(url) {
      return frontend.navigate(url);
    },
    async reload() {
      return frontend.reload();
    }
  };
}

function createBrowserFrameFrontend(
  web: WebRuntime,
  options: {
    frame: HTMLIFrameElement;
    streaming: BrowserFrameStreamingMode;
    syncRealUrl: boolean;
    realUrlBasePath: string;
  }
): BrowserFrameFrontend {
  async function render(response: Response): Promise<void> {
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      return;
    }

    if (options.streaming !== 'buffer') {
      // TODO: support document-write and message-chunks streaming modes.
    }

    const installInterceptors = (): void => {
      installFrameInterceptors(web, options.frame, render);
    };
    options.frame.addEventListener('load', installInterceptors, {
      once: true
    });
    options.frame.srcdoc = await response.text();
    syncRealUrl(web, options);
    installInterceptors();
    setTimeout(() => {
      installInterceptors();
    }, 0);
  }

  return {
    kind: 'browser-frame',
    frame: options.frame,
    streaming: options.streaming,
    async fetch(input, init) {
      return web.fetch(input, init);
    },
    async navigate(url) {
      const response = await web.navigate(url);
      await render(response.clone());
      return response;
    },
    async reload() {
      const response = await web.reload();
      await render(response.clone());
      return response;
    },
    render
  };
}

function installFrameInterceptors(
  web: WebRuntime,
  frame: HTMLIFrameElement,
  render: (response: Response) => Promise<void>
): void {
  const document = frame.contentDocument;
  if (!document) {
    return;
  }
  if (interceptedFrameDocuments.has(document)) {
    return;
  }
  interceptedFrameDocuments.add(document);

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!isDomElement(target)) {
      return;
    }
    const anchor = target.closest('a[href]');
    if (!anchor) {
      return;
    }
    const href = anchor.getAttribute('href');
    if (!href || new URL(href, web.location.href).origin !== web.location.origin) {
      return;
    }
    event.preventDefault();
    void web.navigate(href).then((response) => render(response.clone()));
  });

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!isFormElement(form)) {
      return;
    }
    event.preventDefault();
    const method = (form.method || 'GET').toUpperCase();
    const action = form.getAttribute('action') || web.location.href;
    if (method === 'GET') {
      const url = new URL(action, web.location.href);
      const data = new FormData(form as HTMLFormElement);
      for (const [key, value] of data) {
        url.searchParams.set(key, String(value));
      }
      void web.navigate(url.href).then((response) => render(response.clone()));
      return;
    }
    void web.fetch(action, {
      method,
      body: new FormData(form as HTMLFormElement)
    }).then((response) => render(response.clone()));
  });
}

function isDomElement(value: EventTarget | null): value is Element {
  return typeof value === 'object'
    && value !== null
    && 'nodeType' in value
    && value.nodeType === 1
    && 'closest' in value
    && typeof value.closest === 'function';
}

function isFormElement(value: EventTarget | null): value is HTMLFormElement {
  return isDomElement(value) && value.tagName.toLowerCase() === 'form';
}

function syncRealUrl(
  web: WebRuntime,
  options: {
    syncRealUrl: boolean;
    realUrlBasePath: string;
  }
): void {
  if (!options.syncRealUrl || typeof window === 'undefined') {
    return;
  }
  const basePath = options.realUrlBasePath.replace(/\/$/, '');
  const nextPath = `${basePath}${web.location.pathname}${web.location.search}${web.location.hash}`;
  if (nextPath.startsWith('/')) {
    window.history.pushState({}, '', nextPath);
  }
}
