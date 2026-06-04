import type {
  FetchApp,
  WebRuntimeEnv,
  WebRuntimeContext,
  PipelineTraceController
} from '../core/types.ts';

export interface AsyncDbRuntimeOperationContext {
  contract?: string;
  registry?: unknown;
  refs?: unknown;
  contractRefs?: unknown;
  registeredOnly?: boolean;
}

export interface AsyncDbRuntimeAdapterOptions {
  config: unknown;
  runtime?: 'async-db' | string;
  basePath?: string;
  viewerPath?: string;
  operations?: AsyncDbRuntimeOperationContext;
  contracts?: unknown;
}

export interface AsyncDbApp extends FetchApp {
  readonly asyncDb: {
    readonly config: unknown;
    readonly runtime: string;
    readonly basePath: string;
    readonly viewerPath: string;
    readonly operations: AsyncDbRuntimeOperationContext;
    readonly contracts: unknown;
  };
}

export function createAsyncDbApp(options: AsyncDbRuntimeAdapterOptions): AsyncDbApp {
  const runtime = options.runtime ?? 'async-db';
  const basePath = normalizePath(options.basePath ?? '/db/');
  const viewerPath = normalizePath(options.viewerPath ?? '/__db/');
  const operations = {
    ...(options.operations ?? {})
  };

  return {
    asyncDb: {
      config: options.config,
      runtime,
      basePath,
      viewerPath,
      operations,
      contracts: options.contracts ?? null
    },
    fetch(request, env, context) {
      return fetchAsyncDbPlaceholder(request, env, context, {
        runtime,
        basePath,
        viewerPath,
        operations
      });
    }
  };
}

function fetchAsyncDbPlaceholder(
  request: Request,
  _env: WebRuntimeEnv,
  _context: WebRuntimeContext,
  options: {
    runtime: string;
    basePath: string;
    viewerPath: string;
    operations: AsyncDbRuntimeOperationContext;
  }
): Response {
  const pathname = new URL(request.url).pathname;
  const operationRef = operationRefForPath(pathname, options.basePath);
  recordAsyncDbTrace(_context, request, {
    contract: options.operations.contract ?? null,
    operationRef,
    registeredOnly: options.operations.registeredOnly === true
  });
  const headers = {
    'content-type': 'application/json; charset=utf-8'
  };

  if (options.operations.registeredOnly === true && !operationRef && pathname !== '/' && !pathname.startsWith(options.viewerPath)) {
    return Response.json({
      ok: false,
      runtime: options.runtime,
      registeredOnly: true,
      contract: options.operations.contract ?? null,
      message: 'AsyncDB adapter is configured for registered operations only.'
    }, {
      status: 403,
      headers
    });
  }

  if (pathname === '/' || pathname.startsWith(options.viewerPath)) {
    return Response.json({
      ok: true,
      runtime: options.runtime,
      adapter: '@async/web/runtime/async-db',
      contract: options.operations.contract ?? null,
      registeredOnly: options.operations.registeredOnly === true,
      message: 'AsyncDB adapter placeholder is mounted. @async/db remains the data contract owner.'
    }, {
      headers
    });
  }

  return Response.json({
    ok: false,
    runtime: options.runtime,
    basePath: options.basePath,
    contract: options.operations.contract ?? null,
    operationRef,
    message: 'AsyncDB execution is provided by @async/db; this adapter only owns route placement and runtime context.'
  }, {
    status: 501,
    headers
  });
}

function operationRefForPath(pathname: string, basePath: string): string | null {
  const normalizedBase = normalizePath(basePath).replace(/\/$/, '');
  for (const prefix of [`${normalizedBase}/operations/`, '/operations/']) {
    if (pathname.startsWith(prefix)) {
      return decodeURIComponent(pathname.slice(prefix.length));
    }
  }
  return null;
}

function recordAsyncDbTrace(
  context: WebRuntimeContext,
  request: Request,
  detail: Record<string, unknown>
): void {
  const trace = context.trace as PipelineTraceController;
  if (typeof trace.record !== 'function') {
    return;
  }
  trace.record({
    boundary: 'backend:request',
    method: request.method,
    url: request.url,
    detail: {
      adapter: 'async-db',
      ...detail
    }
  });
}

function normalizePath(path: string): string {
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  return path;
}
