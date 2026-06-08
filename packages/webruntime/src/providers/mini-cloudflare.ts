import { createWebRuntime } from '../core/create-web-runtime.ts';
import { contentTypeForPath } from '../core/content-type.ts';
import { normalizeWebRuntimePath } from '../core/path-utils.ts';
import type {
  EdgeCache,
  EdgeCacheConfig,
  EdgeWorker,
  EdgeWorkerContext,
  WebRuntime
} from '../core/types.ts';

export type MiniCloudflareAssetBody = string | ArrayBuffer | ArrayBufferView;
export type MiniCloudflareBindingValue =
  | string
  | number
  | boolean
  | null
  | MiniCloudflareAssetsBinding
  | MiniCloudflareKVNamespace
  | MiniCloudflareR2Bucket
  | MiniCloudflareD1Database;

export type MiniCloudflareEnv = Record<string, MiniCloudflareBindingValue | undefined> & {
  ASSETS: MiniCloudflareAssetsBinding;
};

export interface MiniCloudflareWorker<Env extends MiniCloudflareEnv = MiniCloudflareEnv> {
  fetch(
    request: Request,
    env: Env,
    context: MiniCloudflareExecutionContext
  ): Promise<Response> | Response;
}

export interface MiniCloudflareExecutionContext {
  readonly region: string;
  readonly caches: MiniCloudflareCacheStorage;
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
  next(request?: Request): Promise<Response>;
}

export interface MiniCloudflareDeploymentOptions<Env extends MiniCloudflareEnv = MiniCloudflareEnv> {
  id: string;
  worker?: MiniCloudflareWorker<Env>;
  assets?: Record<string, MiniCloudflareAssetBody>;
  vars?: Record<string, string | number | boolean | null>;
  kv?: Record<string, MiniCloudflareKVNamespace | Record<string, MiniCloudflareAssetBody>>;
  r2?: Record<string, MiniCloudflareR2Bucket | Record<string, MiniCloudflareR2ObjectInput>>;
  d1?: Record<string, MiniCloudflareD1Database | MiniCloudflareD1Seed>;
  previewOrigin?: string;
  previewHostname?: string;
  region?: string;
  cache?: EdgeCacheConfig;
  fallbackPath?: string | false;
}

export interface MiniCloudflareDeployment<Env extends MiniCloudflareEnv = MiniCloudflareEnv> {
  readonly id: string;
  readonly origin: string;
  readonly previewUrl: string;
  readonly region: string;
  readonly env: Env;
  readonly bindings: MiniCloudflareBindings;
  readonly web: WebRuntime;
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
  manifest(): MiniCloudflareDeploymentManifest;
  waitUntil(): Promise<void>;
}

export interface MiniCloudflareBindings {
  ASSETS: MiniCloudflareAssetsBinding;
  kv: Record<string, MiniCloudflareKVNamespace>;
  r2: Record<string, MiniCloudflareR2Bucket>;
  d1: Record<string, MiniCloudflareD1Database>;
}

export interface MiniCloudflareDeploymentManifest {
  provider: 'mini-cloudflare';
  deploymentId: string;
  previewUrl: string;
  region: string;
  bindings: {
    assets: string[];
    kv: string[];
    r2: string[];
    d1: string[];
  };
}

export interface MiniCloudflareAssetsBinding {
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
  list(): string[];
  snapshot(): Record<string, string>;
}

export interface MiniCloudflareKVNamespace {
  get(key: string, options?: MiniCloudflareKVGetOptions | MiniCloudflareKVGetType): Promise<MiniCloudflareKVGetResult>;
  put(key: string, value: MiniCloudflareAssetBody, options?: MiniCloudflareKVPutOptions): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: MiniCloudflareKVListOptions): Promise<MiniCloudflareKVListResult>;
  snapshot(): Record<string, string>;
}

export type MiniCloudflareKVGetType = 'text' | 'json' | 'arrayBuffer' | 'stream';
export type MiniCloudflareKVGetResult =
  | string
  | unknown
  | ArrayBuffer
  | ReadableStream<Uint8Array>
  | null;

export interface MiniCloudflareKVGetOptions {
  type?: MiniCloudflareKVGetType;
}

export interface MiniCloudflareKVPutOptions {
  metadata?: unknown;
}

export interface MiniCloudflareKVListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

export interface MiniCloudflareKVListResult {
  keys: Array<{
    name: string;
    metadata?: unknown;
  }>;
  list_complete: boolean;
  cursor?: string;
}

export interface MiniCloudflareR2Bucket {
  get(key: string): Promise<MiniCloudflareR2Object | null>;
  put(key: string, value: MiniCloudflareAssetBody, options?: MiniCloudflareR2PutOptions): Promise<MiniCloudflareR2Object>;
  delete(key: string): Promise<void>;
  list(options?: MiniCloudflareR2ListOptions): Promise<MiniCloudflareR2ListResult>;
  snapshot(): Record<string, string>;
}

export type MiniCloudflareR2ObjectInput = MiniCloudflareAssetBody | {
  body: MiniCloudflareAssetBody;
  httpMetadata?: Record<string, string>;
  customMetadata?: Record<string, string>;
};

export interface MiniCloudflareR2PutOptions {
  httpMetadata?: Record<string, string>;
  customMetadata?: Record<string, string>;
}

export interface MiniCloudflareR2Object {
  readonly key: string;
  readonly size: number;
  readonly etag: string;
  readonly uploaded: Date;
  readonly httpMetadata: Record<string, string>;
  readonly customMetadata: Record<string, string>;
  readonly body: ReadableStream<Uint8Array>;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export interface MiniCloudflareR2ListOptions {
  prefix?: string;
  limit?: number;
}

export interface MiniCloudflareR2ListResult {
  objects: Array<{
    key: string;
    size: number;
    etag: string;
    uploaded: Date;
  }>;
  truncated: boolean;
}

export type MiniCloudflareD1Seed = Record<string, MiniCloudflareD1StatementSeed>;

export interface MiniCloudflareD1StatementSeed {
  results?: Array<Record<string, unknown>>;
  success?: boolean;
}

export interface MiniCloudflareD1Database {
  prepare(sql: string): MiniCloudflareD1PreparedStatement;
  seed(sql: string, result: MiniCloudflareD1StatementSeed): void;
  snapshot(): MiniCloudflareD1Seed;
}

export interface MiniCloudflareD1PreparedStatement {
  readonly sql: string;
  bind(...params: unknown[]): MiniCloudflareD1PreparedStatement;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<MiniCloudflareD1Result<T>>;
  raw<T = unknown>(): Promise<T[][]>;
  run<T = Record<string, unknown>>(): Promise<MiniCloudflareD1Result<T>>;
}

export interface MiniCloudflareD1Result<T = Record<string, unknown>> {
  results: T[];
  success: boolean;
  meta: {
    sql: string;
    params: unknown[];
    rows_read: number;
    rows_written: number;
    duration: number;
  };
}

export interface MiniCloudflareCacheStorage {
  readonly default: MiniCloudflareCache;
  open(name: string): Promise<MiniCloudflareCache>;
}

export interface MiniCloudflareCache {
  match(input: string | URL | Request, options?: { ignoreMethod?: boolean }): Promise<Response | undefined>;
  put(input: string | URL | Request, response: Response): Promise<void>;
  delete(input: string | URL | Request): Promise<boolean>;
}

export async function createMiniCloudflareDeployment<Env extends MiniCloudflareEnv = MiniCloudflareEnv>(
  options: MiniCloudflareDeploymentOptions<Env>
): Promise<MiniCloudflareDeployment<Env>> {
  const id = normalizeDeploymentId(options.id);
  const origin = resolvePreviewOrigin(id, options);
  const region = options.region ?? 'local';
  const bindings = createMiniCloudflareBindings(options);
  const env = createMiniCloudflareEnv<Env>(options, bindings);
  const waitUntilPromises = new Set<Promise<unknown>>();
  const worker = createMiniCloudflareEdgeWorker({
    env,
    region,
    waitUntilPromises,
    worker: options.worker ?? createAssetsOnlyWorker<Env>()
  });

  const web = await createWebRuntime({
    origin,
    files: stringifyAssetFiles(options.assets ?? {}),
    app: {
      fetch(request) {
        return bindings.ASSETS.fetch(request);
      }
    },
    pipeline: {
      frontend: {
        kind: 'headless'
      },
      serviceWorker: {
        kind: 'bypass'
      },
      network: {
        kind: 'blocked'
      },
      edge: {
        kind: 'fake',
        worker,
        cache: options.cache,
        region
      },
      backend: {
        kind: 'fetch-app'
      }
    },
    env: stringifyVars(options.vars),
    edgeEnv: stringifyVars(options.vars)
  });

  return {
    id,
    origin,
    previewUrl: `${origin}/`,
    region,
    env,
    bindings,
    web,
    fetch(input, init) {
      return web.fetch(input, init);
    },
    manifest() {
      return {
        provider: 'mini-cloudflare',
        deploymentId: id,
        previewUrl: `${origin}/`,
        region,
        bindings: {
          assets: bindings.ASSETS.list(),
          kv: Object.keys(bindings.kv).sort(),
          r2: Object.keys(bindings.r2).sort(),
          d1: Object.keys(bindings.d1).sort()
        }
      };
    },
    async waitUntil() {
      const settled = await Promise.allSettled([...waitUntilPromises]);
      const rejected = settled.find((result) => result.status === 'rejected');
      if (rejected?.status === 'rejected') {
        throw rejected.reason;
      }
    }
  };
}

export function createMiniCloudflareAssetsBinding(options: {
  files?: Record<string, MiniCloudflareAssetBody>;
  origin?: string;
  fallbackPath?: string | false;
} = {}): MiniCloudflareAssetsBinding {
  const files = normalizeAssetFiles(options.files ?? {});
  const origin = options.origin ?? 'https://mini-cloudflare.local';
  const fallbackPath = options.fallbackPath === false
    ? false
    : normalizeWebRuntimePath(options.fallbackPath ?? '/index.html');

  return {
    async fetch(input, init) {
      const request = toRequest(input, init, origin);
      const method = request.method.toUpperCase();
      if (method !== 'GET' && method !== 'HEAD') {
        return new Response('Method Not Allowed', {
          status: 405
        });
      }

      const filePath = resolveAssetPath(request, files, fallbackPath);
      if (!filePath) {
        return new Response('Not Found', {
          status: 404
        });
      }

      const body = files[filePath]!;
      const headers = new Headers({
        'content-type': contentTypeForPath(filePath)
      });
      return new Response(method === 'HEAD' ? null : bodyToArrayBuffer(body), {
        headers
      });
    },
    list() {
      return Object.keys(files).sort();
    },
    snapshot() {
      return Object.fromEntries(
        Object.entries(files)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([path, value]) => [path, decodeBody(value)])
      );
    }
  };
}

export function createMiniCloudflareKVNamespace(
  initial: Record<string, MiniCloudflareAssetBody> = {}
): MiniCloudflareKVNamespace {
  const store = new Map<string, {
    value: Uint8Array;
    metadata?: unknown;
  }>();

  for (const [key, value] of Object.entries(initial)) {
    store.set(key, {
      value: bodyToUint8Array(value)
    });
  }

  return {
    async get(key, options) {
      const entry = store.get(key);
      if (!entry) {
        return null;
      }
      const type = typeof options === 'string' ? options : options?.type ?? 'text';
      if (type === 'arrayBuffer') {
        return bytesToArrayBuffer(entry.value);
      }
      if (type === 'stream') {
        return new Response(bytesToArrayBuffer(entry.value)).body;
      }
      const text = decodeBytes(entry.value);
      if (type === 'json') {
        return JSON.parse(text);
      }
      return text;
    },
    async put(key, value, options) {
      store.set(key, {
        value: bodyToUint8Array(value),
        metadata: options?.metadata
      });
    },
    async delete(key) {
      store.delete(key);
    },
    async list(options = {}) {
      const all = [...store.entries()]
        .filter(([key]) => !options.prefix || key.startsWith(options.prefix))
        .sort(([left], [right]) => left.localeCompare(right));
      const offset = options.cursor ? Number(options.cursor) : 0;
      const limit = options.limit ?? all.length;
      const page = all.slice(offset, offset + limit);
      const nextOffset = offset + page.length;
      const listComplete = nextOffset >= all.length;
      return {
        keys: page.map(([name, entry]) => ({
          name,
          metadata: entry.metadata
        })),
        list_complete: listComplete,
        cursor: listComplete ? undefined : String(nextOffset)
      };
    },
    snapshot() {
      return Object.fromEntries(
        [...store.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, entry]) => [key, decodeBytes(entry.value)])
      );
    }
  };
}

export function createMiniCloudflareR2Bucket(
  initial: Record<string, MiniCloudflareR2ObjectInput> = {}
): MiniCloudflareR2Bucket {
  const store = new Map<string, StoredR2Object>();

  const bucket: MiniCloudflareR2Bucket = {
    async get(key) {
      const object = store.get(key);
      return object ? toR2Object(object) : null;
    },
    async put(key, value, options = {}) {
      const input = normalizeR2Input(value, options);
      const stored = createStoredR2Object(key, input.body, input);
      store.set(key, stored);
      return toR2Object(stored);
    },
    async delete(key) {
      store.delete(key);
    },
    async list(options = {}) {
      const all = [...store.values()]
        .filter((object) => !options.prefix || object.key.startsWith(options.prefix))
        .sort((left, right) => left.key.localeCompare(right.key));
      const limit = options.limit ?? all.length;
      const page = all.slice(0, limit);
      return {
        objects: page.map((object) => ({
          key: object.key,
          size: object.body.byteLength,
          etag: object.etag,
          uploaded: new Date(object.uploaded)
        })),
        truncated: page.length < all.length
      };
    },
    snapshot() {
      return Object.fromEntries(
        [...store.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, object]) => [key, decodeBytes(object.body)])
      );
    }
  };

  for (const [key, value] of Object.entries(initial)) {
    const input = normalizeR2Input(value);
    store.set(key, createStoredR2Object(key, input.body, input));
  }

  return bucket;
}

export function createMiniCloudflareD1Database(seed: MiniCloudflareD1Seed = {}): MiniCloudflareD1Database {
  const statements = new Map<string, MiniCloudflareD1StatementSeed>();
  for (const [sql, result] of Object.entries(seed)) {
    statements.set(normalizeSql(sql), cloneD1Seed(result));
  }

  return {
    prepare(sql) {
      return createD1PreparedStatement(sql, [], statements);
    },
    seed(sql, result) {
      statements.set(normalizeSql(sql), cloneD1Seed(result));
    },
    snapshot() {
      return Object.fromEntries(
        [...statements.entries()].sort(([left], [right]) => left.localeCompare(right))
      );
    }
  };
}

export function createMiniCloudflareBindings<Env extends MiniCloudflareEnv = MiniCloudflareEnv>(
  options: MiniCloudflareDeploymentOptions<Env>
): MiniCloudflareBindings {
  const assets = createMiniCloudflareAssetsBinding({
    files: options.assets,
    fallbackPath: options.fallbackPath
  });
  const kv = Object.fromEntries(
    Object.entries(options.kv ?? {}).map(([name, value]) => [
      name,
      isKVNamespace(value) ? value : createMiniCloudflareKVNamespace(value)
    ])
  );
  const r2 = Object.fromEntries(
    Object.entries(options.r2 ?? {}).map(([name, value]) => [
      name,
      isR2Bucket(value) ? value : createMiniCloudflareR2Bucket(value)
    ])
  );
  const d1 = Object.fromEntries(
    Object.entries(options.d1 ?? {}).map(([name, value]) => [
      name,
      isD1Database(value) ? value : createMiniCloudflareD1Database(value)
    ])
  );

  return {
    ASSETS: assets,
    kv,
    r2,
    d1
  };
}

function createMiniCloudflareEnv<Env extends MiniCloudflareEnv>(
  options: MiniCloudflareDeploymentOptions<Env>,
  bindings: MiniCloudflareBindings
): Env {
  return {
    ...options.vars,
    ASSETS: bindings.ASSETS,
    ...bindings.kv,
    ...bindings.r2,
    ...bindings.d1
  } as Env;
}

function createMiniCloudflareEdgeWorker<Env extends MiniCloudflareEnv>(options: {
  env: Env;
  region: string;
  waitUntilPromises: Set<Promise<unknown>>;
  worker: MiniCloudflareWorker<Env>;
}): EdgeWorker {
  return {
    async fetch(request, _env, context) {
      const executionContext = createMiniCloudflareExecutionContext({
        request,
        context,
        region: options.region,
        waitUntilPromises: options.waitUntilPromises
      });
      return options.worker.fetch(request, options.env, executionContext);
    }
  };
}

function createMiniCloudflareExecutionContext(options: {
  request: Request;
  context: EdgeWorkerContext;
  region: string;
  waitUntilPromises: Set<Promise<unknown>>;
}): MiniCloudflareExecutionContext {
  return {
    region: options.region,
    caches: createMiniCloudflareCacheStorage(options.context.edgeCache, options.request.url),
    waitUntil(promise) {
      const tracked = Promise.resolve(promise);
      options.waitUntilPromises.add(tracked);
      void tracked
        .catch(() => undefined)
        .finally(() => {
          options.waitUntilPromises.delete(tracked);
        });
      options.context.waitUntil(tracked.catch(() => undefined));
    },
    passThroughOnException() {
      options.context.passThroughOnException();
    },
    next(request = options.request) {
      return options.context.next(request);
    }
  };
}

function createMiniCloudflareCacheStorage(edgeCache: EdgeCache, baseUrl: string): MiniCloudflareCacheStorage {
  return {
    default: createMiniCloudflareCache(edgeCache, baseUrl),
    async open() {
      return createMiniCloudflareCache(edgeCache, baseUrl);
    }
  };
}

function createMiniCloudflareCache(edgeCache: EdgeCache, baseUrl: string): MiniCloudflareCache {
  return {
    match(input, options) {
      return edgeCache.match(toRequest(input, undefined, baseUrl), options);
    },
    put(input, response) {
      return edgeCache.put(toRequest(input, undefined, baseUrl), response);
    },
    delete(input) {
      return edgeCache.delete(toRequest(input, undefined, baseUrl));
    }
  };
}

function createAssetsOnlyWorker<Env extends MiniCloudflareEnv>(): MiniCloudflareWorker<Env> {
  return {
    fetch(request, env) {
      return env.ASSETS.fetch(request);
    }
  };
}

function resolvePreviewOrigin<Env extends MiniCloudflareEnv>(
  id: string,
  options: MiniCloudflareDeploymentOptions<Env>
): string {
  if (options.previewOrigin) {
    return new URL(options.previewOrigin).origin;
  }
  const hostname = options.previewHostname ?? `${id}.preview.async.local`;
  return `https://${hostname}`;
}

function resolveAssetPath(
  request: Request,
  files: Record<string, MiniCloudflareAssetBody>,
  fallbackPath: string | false
): string | null {
  const url = new URL(request.url);
  const pathname = normalizeWebRuntimePath(url.pathname);
  const candidates = [
    pathname,
    `${pathname.replace(/\/$/, '')}/index.html`
  ];
  for (const candidate of candidates) {
    if (files[candidate]) {
      return candidate;
    }
  }
  if (fallbackPath && files[fallbackPath]) {
    return fallbackPath;
  }
  return null;
}

function createD1PreparedStatement(
  sql: string,
  params: unknown[],
  statements: Map<string, MiniCloudflareD1StatementSeed>
): MiniCloudflareD1PreparedStatement {
  return {
    sql,
    bind(...nextParams) {
      return createD1PreparedStatement(sql, nextParams, statements);
    },
    async first<T = Record<string, unknown>>(columnName?: string): Promise<T | null> {
      const result = createD1Result<Record<string, unknown>>(sql, params, statements);
      const row = result.results[0] ?? null;
      if (!row) {
        return null;
      }
      if (!columnName) {
        return row as T;
      }
      return row[columnName] as T;
    },
    async all() {
      return createD1Result(sql, params, statements);
    },
    async raw() {
      const result = createD1Result(sql, params, statements);
      return result.results.map((row) => Object.values(row)) as never;
    },
    async run() {
      return createD1Result(sql, params, statements);
    }
  };
}

function createD1Result<T = Record<string, unknown>>(
  sql: string,
  params: unknown[],
  statements: Map<string, MiniCloudflareD1StatementSeed>
): MiniCloudflareD1Result<T> {
  const seed = statements.get(normalizeSql(sql)) ?? {
    results: []
  };
  const results = (seed.results ?? []) as T[];
  return {
    results,
    success: seed.success ?? true,
    meta: {
      sql,
      params,
      rows_read: results.length,
      rows_written: isWriteSql(sql) ? results.length : 0,
      duration: 0
    }
  };
}

function normalizeAssetFiles(files: Record<string, MiniCloudflareAssetBody>): Record<string, MiniCloudflareAssetBody> {
  return Object.fromEntries(
    Object.entries(files).map(([path, value]) => [
      normalizeWebRuntimePath(path),
      value
    ])
  );
}

function normalizeDeploymentId(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!normalized) {
    throw new Error('Mini Cloudflare deployment id must contain at least one letter or number');
  }
  return normalized;
}

function normalizeSql(sql: string): string {
  return sql.trim().replace(/\s+/g, ' ').toLowerCase();
}

function isWriteSql(sql: string): boolean {
  return /^(insert|update|delete|create|drop|alter|replace)\b/i.test(sql.trim());
}

function stringifyAssetFiles(files: Record<string, MiniCloudflareAssetBody>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(normalizeAssetFiles(files)).map(([path, value]) => [
      path,
      decodeBody(value)
    ])
  );
}

function stringifyVars(vars: MiniCloudflareDeploymentOptions['vars']): Record<string, string> {
  return Object.fromEntries(
    Object.entries(vars ?? {}).map(([key, value]) => [
      key,
      value == null ? String(value) : String(value)
    ])
  );
}

function toRequest(input: string | URL | Request, init: RequestInit | undefined, baseUrl: string): Request {
  if (input instanceof Request) {
    return init ? new Request(input, init) : input;
  }
  return new Request(new URL(String(input), baseUrl), init);
}

function bodyToUint8Array(body: MiniCloudflareAssetBody): Uint8Array {
  if (typeof body === 'string') {
    return new TextEncoder().encode(body);
  }
  if (body instanceof ArrayBuffer) {
    return new Uint8Array(body);
  }
  return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
}

function bodyToArrayBuffer(body: MiniCloudflareAssetBody): ArrayBuffer {
  return bytesToArrayBuffer(bodyToUint8Array(body));
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function cloneBytes(value: Uint8Array): Uint8Array {
  return new Uint8Array(value);
}

function decodeBody(body: MiniCloudflareAssetBody): string {
  return decodeBytes(bodyToUint8Array(body));
}

function decodeBytes(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

interface StoredR2Object {
  key: string;
  body: Uint8Array;
  etag: string;
  uploaded: number;
  httpMetadata: Record<string, string>;
  customMetadata: Record<string, string>;
}

function normalizeR2Input(
  value: MiniCloudflareR2ObjectInput,
  options: MiniCloudflareR2PutOptions = {}
): {
  body: MiniCloudflareAssetBody;
  httpMetadata: Record<string, string>;
  customMetadata: Record<string, string>;
} {
  if (isR2ObjectInput(value)) {
    return {
      body: value.body,
      httpMetadata: value.httpMetadata ?? options.httpMetadata ?? {},
      customMetadata: value.customMetadata ?? options.customMetadata ?? {}
    };
  }
  return {
    body: value,
    httpMetadata: options.httpMetadata ?? {},
    customMetadata: options.customMetadata ?? {}
  };
}

function isR2ObjectInput(value: MiniCloudflareR2ObjectInput): value is Exclude<MiniCloudflareR2ObjectInput, MiniCloudflareAssetBody> {
  return typeof value === 'object'
    && value !== null
    && !(value instanceof ArrayBuffer)
    && !ArrayBuffer.isView(value)
    && 'body' in value;
}

function createStoredR2Object(
  key: string,
  body: MiniCloudflareAssetBody,
  options: Pick<StoredR2Object, 'httpMetadata' | 'customMetadata'>
): StoredR2Object {
  const bytes = bodyToUint8Array(body);
  return {
    key,
    body: bytes,
    etag: createEtag(bytes),
    uploaded: Date.now(),
    httpMetadata: options.httpMetadata,
    customMetadata: options.customMetadata
  };
}

function toR2Object(object: StoredR2Object): MiniCloudflareR2Object {
  const bytes = cloneBytes(object.body);
  return {
    key: object.key,
    size: bytes.byteLength,
    etag: object.etag,
    uploaded: new Date(object.uploaded),
    httpMetadata: {
      ...object.httpMetadata
    },
    customMetadata: {
      ...object.customMetadata
    },
    body: new Response(bytesToArrayBuffer(bytes)).body!,
    async arrayBuffer() {
      return bytesToArrayBuffer(bytes);
    },
    async text() {
      return decodeBytes(bytes);
    },
    async json() {
      return JSON.parse(decodeBytes(bytes));
    }
  };
}

function createEtag(bytes: Uint8Array): string {
  let checksum = 0;
  for (const byte of bytes) {
    checksum = (checksum + byte) % 65535;
  }
  return `"mini-${bytes.byteLength}-${checksum}"`;
}

function cloneD1Seed(seed: MiniCloudflareD1StatementSeed): MiniCloudflareD1StatementSeed {
  return {
    success: seed.success,
    results: seed.results?.map((row) => ({
      ...row
    }))
  };
}

function isKVNamespace(value: unknown): value is MiniCloudflareKVNamespace {
  return typeof value === 'object'
    && value !== null
    && 'get' in value
    && 'put' in value
    && 'list' in value;
}

function isR2Bucket(value: unknown): value is MiniCloudflareR2Bucket {
  return typeof value === 'object'
    && value !== null
    && 'get' in value
    && 'put' in value
    && 'delete' in value;
}

function isD1Database(value: unknown): value is MiniCloudflareD1Database {
  return typeof value === 'object'
    && value !== null
    && 'prepare' in value
    && 'seed' in value;
}
