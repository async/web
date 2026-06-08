import type { IncomingMessage, ServerResponse } from 'node:http';
import { Buffer } from 'node:buffer';
import { createHttpTestServer, type HttpTestServer } from './create-http-test-server.ts';
import type { MiniCloudflareDeployment } from '../providers/mini-cloudflare.ts';

export interface MiniCloudflarePreviewServer {
  readonly origin: string;
  readonly url: string;
  readonly server: HttpTestServer['server'];
  close(): Promise<void>;
}

export interface ServeMiniCloudflareDeploymentOptions {
  basePath?: string;
}

export async function serveMiniCloudflareDeployment(
  deployment: MiniCloudflareDeployment,
  options: ServeMiniCloudflareDeploymentOptions = {}
): Promise<MiniCloudflarePreviewServer> {
  const basePath = normalizeBasePath(options.basePath ?? '/');
  const server = await createHttpTestServer(async (request, response) => {
    try {
      await proxyToDeployment(deployment, basePath, request, response);
    } catch (error) {
      response.writeHead(500, {
        'content-type': 'text/plain; charset=utf-8'
      });
      response.end(error instanceof Error ? error.message : String(error));
    }
  });

  return {
    origin: server.origin,
    url: `${server.origin}${basePath === '/' ? '/' : `${basePath}/`}`,
    server: server.server,
    close() {
      return server.close();
    }
  };
}

async function proxyToDeployment(
  deployment: MiniCloudflareDeployment,
  basePath: string,
  incoming: IncomingMessage,
  outgoing: ServerResponse
): Promise<void> {
  const method = incoming.method ?? 'GET';
  const incomingUrl = new URL(incoming.url ?? '/', 'http://localhost');
  if (basePath !== '/' && !matchesBasePath(incomingUrl.pathname, basePath)) {
    outgoing.writeHead(404, {
      'content-type': 'text/plain; charset=utf-8'
    });
    outgoing.end('Not Found');
    return;
  }

  const target = new URL(stripBasePath(incomingUrl.pathname, basePath), deployment.origin);
  target.search = incomingUrl.search;
  const headers = headersFromIncoming(incoming);
  const body = method === 'GET' || method === 'HEAD'
    ? undefined
    : await readIncomingBody(incoming);
  const request = new Request(target, {
    method,
    headers,
    body,
    duplex: body ? 'half' : undefined
  } as RequestInit & { duplex?: 'half' });

  const response = await deployment.fetch(request);
  const responseHeaders = headersToOutgoing(response.headers);
  outgoing.writeHead(response.status, response.statusText, responseHeaders);
  const responseBody = Buffer.from(await response.arrayBuffer());
  outgoing.end(responseBody);
}

function headersFromIncoming(request: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
    } else {
      headers.set(name, value);
    }
  }
  return headers;
}

function headersToOutgoing(headers: Headers): Record<string, string[]> {
  const outgoing: Record<string, string[]> = {};
  for (const [name, value] of headers) {
    outgoing[name] = [...(outgoing[name] ?? []), value];
  }
  return outgoing;
}

async function readIncomingBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function normalizeBasePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '/') {
    return '/';
  }
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
}

function matchesBasePath(pathname: string, basePath: string): boolean {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

function stripBasePath(pathname: string, basePath: string): string {
  if (basePath === '/') {
    return pathname;
  }
  const stripped = pathname.slice(basePath.length);
  return stripped.startsWith('/') ? stripped : `/${stripped}`;
}
