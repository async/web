import { createFrameRpcClient, type FrameRpcClient } from './frame-rpc.ts';

export interface RuntimeFrameOptions {
  parent: HTMLElement;
  title?: string;
  className?: string;
  location?: string;
  sandbox?: string;
  srcdoc?: string;
}

export interface RuntimeFrameTransport {
  readonly frame: HTMLIFrameElement;
  readonly client: FrameRpcClient;
  destroy(): void;
}

export function createRuntimeFrame(options: RuntimeFrameOptions): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  frame.title = options.title ?? 'WebRuntime runtime';
  frame.className = options.className ?? 'webRuntime-runtime-frame';
  frame.setAttribute('sandbox', options.sandbox ?? 'allow-scripts');
  if (options.location) {
    frame.dataset.webRuntimeLocation = options.location;
  }
  if (options.srcdoc) {
    frame.srcdoc = options.srcdoc;
  }
  options.parent.append(frame);
  return frame;
}

export function createRuntimeFrameTransport(options: RuntimeFrameOptions & {
  targetOrigin?: string;
  timeoutMs?: number;
}): RuntimeFrameTransport {
  const frame = createRuntimeFrame(options);
  if (!frame.contentWindow) {
    throw new Error('WebRuntime runtime frame is missing contentWindow');
  }
  const client = createFrameRpcClient({
    targetWindow: frame.contentWindow,
    targetOrigin: options.targetOrigin,
    timeoutMs: options.timeoutMs
  });

  return {
    frame,
    client,
    destroy() {
      client.destroy();
      frame.remove();
    }
  };
}
