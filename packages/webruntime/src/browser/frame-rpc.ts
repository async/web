export interface FrameRpcClient {
  call<T>(command: string, payload?: unknown): Promise<T>;
  destroy(): void;
}

export interface FrameRpcServer {
  register(command: string, handler: FrameRpcHandler): void;
  destroy(): void;
}

export type FrameRpcHandler = (payload: unknown) => Promise<unknown> | unknown;

export interface FrameRpcRequest {
  type: 'webruntime:request';
  requestId: string;
  command: string;
  payload?: unknown;
}

export interface FrameRpcResponse {
  type: 'webruntime:response';
  requestId: string;
  result?: unknown;
  error?: {
    message: string;
  };
}

export interface FrameRpcSerializedRequest {
  url: string;
  method: string;
  headers: Array<[string, string]>;
  body?: string;
  bodyEncoding?: 'base64';
}

export interface FrameRpcSerializedResponse {
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
  body?: string;
  bodyEncoding?: 'base64';
}

export function createFrameRpcClient(options: {
  targetWindow: Window;
  targetOrigin?: string;
  timeoutMs?: number;
}): FrameRpcClient {
  const pending = new Map<string, {
    resolve(value: unknown): void;
    reject(error: Error): void;
    timer: number;
  }>();
  const targetOrigin = options.targetOrigin ?? '*';
  const timeoutMs = options.timeoutMs ?? 5000;

  function onMessage(event: MessageEvent): void {
    if (event.source !== options.targetWindow || !isFrameRpcResponse(event.data)) {
      return;
    }
    const entry = pending.get(event.data.requestId);
    if (!entry) {
      return;
    }
    window.clearTimeout(entry.timer);
    pending.delete(event.data.requestId);
    if (event.data.error) {
      entry.reject(new Error(event.data.error.message));
      return;
    }
    entry.resolve(event.data.result);
  }

  window.addEventListener('message', onMessage);

  return {
    call(command, payload) {
      const requestId = crypto.randomUUID();
      const request: FrameRpcRequest = {
        type: 'webruntime:request',
        requestId,
        command,
        payload
      };
      return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
          pending.delete(requestId);
          reject(new Error(`WebRuntime frame RPC timed out: ${command}`));
        }, timeoutMs);
        pending.set(requestId, {
          resolve,
          reject,
          timer
        });
        options.targetWindow.postMessage(request, targetOrigin);
      });
    },
    destroy() {
      window.removeEventListener('message', onMessage);
      for (const entry of pending.values()) {
        window.clearTimeout(entry.timer);
        entry.reject(new Error('WebRuntime frame RPC client destroyed'));
      }
      pending.clear();
    }
  };
}

export function createFrameRpcServer(options: {
  allowedSource?: Window;
  allowedOrigin?: string;
} = {}): FrameRpcServer {
  const handlers = new Map<string, FrameRpcHandler>();

  async function onMessage(event: MessageEvent): Promise<void> {
    if (options.allowedSource && event.source !== options.allowedSource) {
      return;
    }
    if (options.allowedOrigin && event.origin !== options.allowedOrigin) {
      return;
    }
    if (!isFrameRpcRequest(event.data)) {
      return;
    }
    const handler = handlers.get(event.data.command);
    const source = event.source;
    if (!source || typeof source.postMessage !== 'function') {
      return;
    }
    const response: FrameRpcResponse = {
      type: 'webruntime:response',
      requestId: event.data.requestId
    };
    try {
      if (!handler) {
        throw new Error(`Unknown WebRuntime frame RPC command: ${event.data.command}`);
      }
      response.result = await handler(event.data.payload);
    } catch (error) {
      response.error = {
        message: error instanceof Error ? error.message : String(error)
      };
    }
    source.postMessage(response, {
      targetOrigin: event.origin || '*'
    });
  }

  window.addEventListener('message', onMessage);

  return {
    register(command, handler) {
      handlers.set(command, handler);
    },
    destroy() {
      window.removeEventListener('message', onMessage);
      handlers.clear();
    }
  };
}

export async function serializeFrameRequest(request: Request): Promise<FrameRpcSerializedRequest> {
  const serialized: FrameRpcSerializedRequest = {
    url: request.url,
    method: request.method,
    headers: Array.from(request.headers.entries())
  };
  if (request.body && request.method !== 'GET' && request.method !== 'HEAD') {
    serialized.body = bytesToBase64(new Uint8Array(await request.arrayBuffer()));
    serialized.bodyEncoding = 'base64';
  }
  return serialized;
}

export function deserializeFrameRequest(serialized: FrameRpcSerializedRequest): Request {
  const init: RequestInit & { duplex?: 'half' } = {
    method: serialized.method,
    headers: serialized.headers
  };
  if (serialized.body) {
    init.body = base64ToArrayBuffer(serialized.body);
    init.duplex = 'half';
  }
  return new Request(serialized.url, init);
}

export async function serializeFrameResponse(response: Response): Promise<FrameRpcSerializedResponse> {
  const serialized: FrameRpcSerializedResponse = {
    status: response.status,
    statusText: response.statusText,
    headers: Array.from(response.headers.entries())
  };
  if (response.body) {
    serialized.body = bytesToBase64(new Uint8Array(await response.arrayBuffer()));
    serialized.bodyEncoding = 'base64';
  }
  return serialized;
}

export function deserializeFrameResponse(serialized: FrameRpcSerializedResponse): Response {
  return new Response(serialized.body ? base64ToArrayBuffer(serialized.body) : null, {
    status: serialized.status,
    statusText: serialized.statusText,
    headers: serialized.headers
  });
}

function isFrameRpcRequest(value: unknown): value is FrameRpcRequest {
  return isRecord(value)
    && value.type === 'webruntime:request'
    && typeof value.requestId === 'string'
    && typeof value.command === 'string';
}

function isFrameRpcResponse(value: unknown): value is FrameRpcResponse {
  return isRecord(value)
    && value.type === 'webruntime:response'
    && typeof value.requestId === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const bytes = base64ToBytes(value);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
