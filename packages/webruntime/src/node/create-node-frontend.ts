import { Window } from 'happy-dom';
import type { WebRuntime } from '../core/types.ts';

export interface NodeFrontend {
  readonly kind: 'node-dom';
  navigate(url: string): Promise<void>;
  reload(): Promise<void>;
  click(selector: string): Promise<void>;
  submit(selector: string, formData?: Record<string, string>): Promise<void>;
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
  html(): string;
  text(selector: string): string;
  attr(selector: string, name: string): string | null;
  exists(selector: string): boolean;
}

interface NodeElementHandle {
  tagName?: string;
  textContent?: string | null;
  getAttribute(name: string): string | null;
  dispatchEvent(event: Event): boolean;
}

export function createNodeFrontend(web: WebRuntime): NodeFrontend {
  let window: Window = createWindow(web.location.href);

  async function render(response: Response): Promise<void> {
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      return;
    }
    const html = await response.text();
    window = createWindow(web.location.href);
    window.document.write(html);
    window.document.close();
  }

  function requireElement(selector: string): NodeElementHandle {
    const element = window.document.querySelector(selector);
    if (!element) {
      throw new Error(`WebRuntime node frontend selector not found: ${selector}`);
    }
    return element as unknown as NodeElementHandle;
  }

  return {
    kind: 'node-dom',
    async navigate(url) {
      const response = await web.navigate(url);
      await render(response);
    },
    async reload() {
      const response = await web.reload();
      await render(response);
    },
    async click(selector) {
      const element = requireElement(selector);
      if (isElementTag(element, 'a')) {
        const href = element.getAttribute('href');
        if (!href) {
          throw new Error(`WebRuntime anchor is missing href: ${selector}`);
        }
        await this.navigate(href);
        return;
      }
      element.dispatchEvent(new window.MouseEvent('click', {
        bubbles: true,
        cancelable: true
      }) as unknown as Event);
    },
    async submit(selector, formData = {}) {
      const element = requireElement(selector);
      if (!isElementTag(element, 'form')) {
        throw new Error(`WebRuntime selector is not a form: ${selector}`);
      }
      const method = (element.getAttribute('method') ?? 'GET').toUpperCase();
      const action = element.getAttribute('action') ?? web.location.pathname;
      if (method === 'GET') {
        const url = new URL(action, web.location.href);
        for (const [key, value] of Object.entries(formData)) {
          url.searchParams.set(key, value);
        }
        await this.navigate(url.href);
        return;
      }
      const response = await web.fetch(action, {
        method,
        body: new URLSearchParams(formData)
      });
      await render(response);
    },
    fetch(input, init) {
      return web.fetch(input, init);
    },
    html() {
      return window.document.documentElement.outerHTML;
    },
    text(selector) {
      return requireElement(selector).textContent?.trim() ?? '';
    },
    attr(selector, name) {
      return requireElement(selector).getAttribute(name);
    },
    exists(selector) {
      return window.document.querySelector(selector) !== null;
    }
  };
}

function createWindow(url: string): Window {
  return new Window({
    url
  });
}

function isElementTag(
  element: { tagName?: string },
  tagName: string
): boolean {
  return element.tagName?.toLowerCase() === tagName;
}
