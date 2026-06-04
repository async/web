export type AsyncRouteInput = AsyncRouteStep | readonly AsyncRouteInput[];
export type AsyncRouteMethod = string;
export type AsyncRouteCacheStrategy =
  | 'cache-first'
  | 'network-first'
  | 'stale-while-revalidate'
  | 'cache-only'
  | 'network-only';

export interface AsyncAppRoute {
  type: 'app';
  app: string;
}

export interface AsyncMountRoute {
  type: 'mount';
  path: string;
  to: AsyncRouteStep[];
}

export interface AsyncHostRoute {
  type: 'host';
  hostname: string;
  to: AsyncRouteStep[];
}

export interface AsyncMethodRoute {
  type: 'method';
  method: AsyncRouteMethod;
  path?: string;
  to: AsyncRouteStep[];
}

export interface AsyncOriginRoute {
  type: 'origin';
  origin: string;
}

export interface AsyncFilesRoute {
  type: 'files';
  publicPrefix?: string;
  filePrefix?: string;
  cacheControl?: string;
}

export interface AsyncRedirectRoute {
  type: 'redirect';
  url: string;
  status?: number;
}

export interface AsyncCacheRoute {
  type: 'cache';
  strategy: AsyncRouteCacheStrategy;
  store?: 'service-worker' | 'edge' | `named:${string}`;
  ttl?: number;
  tags?: string[];
  key?: string;
  next?: AsyncRouteStep[];
}

export interface AsyncSplitTrafficVariant {
  name?: string;
  weight: number;
  to: AsyncRouteStep[];
}

export interface AsyncSplitTrafficRoute {
  type: 'split-traffic';
  variants: AsyncSplitTrafficVariant[];
}

export interface AsyncTryAppOptions {
  fallthroughStatus?: readonly number[];
}

export interface AsyncTryAppRoute {
  type: 'try-app';
  fallthroughStatus: number[];
  candidates: AsyncRouteStep[];
}

export type AsyncRouteStep =
  | AsyncAppRoute
  | AsyncMountRoute
  | AsyncHostRoute
  | AsyncMethodRoute
  | AsyncOriginRoute
  | AsyncFilesRoute
  | AsyncRedirectRoute
  | AsyncCacheRoute
  | AsyncSplitTrafficRoute
  | AsyncTryAppRoute;

export function toApp(app: string): AsyncAppRoute {
  return {
    type: 'app',
    app
  };
}

export function mount(path: string, to: AsyncRouteInput): AsyncMountRoute {
  return {
    type: 'mount',
    path,
    to: normalizeRoutes(to)
  };
}

export function host(hostname: string, to: AsyncRouteInput): AsyncHostRoute {
  return {
    type: 'host',
    hostname,
    to: normalizeRoutes(to)
  };
}

export function method(
  methodName: AsyncRouteMethod,
  pathOrTo: string | AsyncRouteInput,
  to?: AsyncRouteInput
): AsyncMethodRoute {
  const hasPath = typeof pathOrTo === 'string';
  return {
    type: 'method',
    method: methodName.toUpperCase(),
    path: hasPath ? pathOrTo : undefined,
    to: normalizeRoutes(hasPath ? to ?? [] : pathOrTo)
  };
}

export function toOrigin(origin: string): AsyncOriginRoute {
  return {
    type: 'origin',
    origin
  };
}

export function toFiles(options: Omit<AsyncFilesRoute, 'type'> = {}): AsyncFilesRoute {
  return {
    type: 'files',
    ...options
  };
}

export function redirect(url: string, status?: number): AsyncRedirectRoute {
  return {
    type: 'redirect',
    url,
    status
  };
}

export function cacheFirst(options: Omit<AsyncCacheRoute, 'type' | 'strategy' | 'next'> & {
  next?: AsyncRouteInput;
} = {}): AsyncCacheRoute {
  return cacheRoute('cache-first', options);
}

export function networkFirst(options: Omit<AsyncCacheRoute, 'type' | 'strategy' | 'next'> & {
  next?: AsyncRouteInput;
} = {}): AsyncCacheRoute {
  return cacheRoute('network-first', options);
}

export function staleWhileRevalidate(options: Omit<AsyncCacheRoute, 'type' | 'strategy' | 'next'> & {
  next?: AsyncRouteInput;
} = {}): AsyncCacheRoute {
  return cacheRoute('stale-while-revalidate', options);
}

export function cacheOnly(options: Omit<AsyncCacheRoute, 'type' | 'strategy' | 'next'> = {}): AsyncCacheRoute {
  return cacheRoute('cache-only', options);
}

export function networkOnly(): AsyncCacheRoute {
  return cacheRoute('network-only', {});
}

export function splitTraffic(variants: Array<{
  name?: string;
  weight: number;
  to: AsyncRouteInput;
}>): AsyncSplitTrafficRoute {
  return {
    type: 'split-traffic',
    variants: variants.map((variant) => ({
      ...variant,
      to: normalizeRoutes(variant.to)
    }))
  };
}

export function tryApp(
  options: AsyncTryAppOptions = {},
  candidates: AsyncRouteInput
): AsyncTryAppRoute {
  return {
    type: 'try-app',
    fallthroughStatus: [
      ...(options.fallthroughStatus ?? [404])
    ],
    candidates: normalizeRoutes(candidates)
  };
}

export function normalizeRoutes(input: AsyncRouteInput | undefined): AsyncRouteStep[] {
  if (!input) {
    return [];
  }
  if (isRouteInputArray(input)) {
    return input.flatMap((route) => normalizeRoutes(route));
  }
  return [
    input
  ];
}

function isRouteInputArray(input: AsyncRouteInput): input is readonly AsyncRouteInput[] {
  return Array.isArray(input);
}

export function validateRoutes(input: AsyncRouteInput): string[] {
  const issues: string[] = [];
  for (const route of normalizeRoutes(input)) {
    validateRoute(route, issues, route.type);
  }
  return issues;
}

export function printRouteTable(input: AsyncRouteInput): string {
  const rows = [
    'TYPE\tMATCH\tTARGET'
  ];
  for (const route of normalizeRoutes(input)) {
    appendRouteRows(route, rows, '');
  }
  return rows.join('\n');
}

function cacheRoute(
  strategy: AsyncRouteCacheStrategy,
  options: Omit<AsyncCacheRoute, 'type' | 'strategy' | 'next'> & {
    next?: AsyncRouteInput;
  }
): AsyncCacheRoute {
  const { next, ...rest } = options;
  return {
    type: 'cache',
    strategy,
    ...rest,
    next: next ? normalizeRoutes(next) : undefined
  };
}

function validateRoute(route: AsyncRouteStep, issues: string[], path: string): void {
  if (route.type === 'app' && route.app.length === 0) {
    issues.push(`${path}: app route requires an app name`);
  }
  if (route.type === 'mount' && !route.path.startsWith('/')) {
    issues.push(`${path}: mount path must start with /`);
  }
  if (route.type === 'origin') {
    try {
      new URL(route.origin);
    } catch {
      issues.push(`${path}: origin must be a valid URL`);
    }
  }
  if (route.type === 'redirect' && route.status !== undefined && (route.status < 300 || route.status > 399)) {
    issues.push(`${path}: redirect status must be a 3xx status`);
  }
  if (route.type === 'cache' && route.ttl !== undefined && route.ttl < 0) {
    issues.push(`${path}: cache ttl must be non-negative`);
  }
  if (route.type === 'split-traffic') {
    const total = route.variants.reduce((sum, variant) => sum + variant.weight, 0);
    if (route.variants.length === 0) {
      issues.push(`${path}: splitTraffic requires at least one variant`);
    }
    if (total <= 0) {
      issues.push(`${path}: splitTraffic variant weights must total more than 0`);
    }
  }
  if (route.type === 'try-app') {
    if (route.candidates.length === 0) {
      issues.push(`${path}: tryApp requires at least one candidate`);
    }
    if (route.fallthroughStatus.some((status) => status < 100 || status > 599)) {
      issues.push(`${path}: tryApp fallthroughStatus values must be HTTP status codes`);
    }
  }
  for (const child of childrenForRoute(route)) {
    validateRoute(child, issues, `${path}.${child.type}`);
  }
}

function childrenForRoute(route: AsyncRouteStep): AsyncRouteStep[] {
  if ('to' in route) {
    return route.to;
  }
  if (route.type === 'cache') {
    return route.next ?? [];
  }
  if (route.type === 'split-traffic') {
    return route.variants.flatMap((variant) => variant.to);
  }
  if (route.type === 'try-app') {
    return route.candidates;
  }
  return [];
}

function appendRouteRows(route: AsyncRouteStep, rows: string[], indent: string): void {
  rows.push(`${indent}${route.type}\t${routeMatch(route)}\t${routeTarget(route)}`);
  for (const child of childrenForRoute(route)) {
    appendRouteRows(child, rows, `${indent}  `);
  }
}

function routeMatch(route: AsyncRouteStep): string {
  switch (route.type) {
    case 'mount':
      return route.path;
    case 'host':
      return route.hostname;
    case 'method':
      return route.path ? `${route.method} ${route.path}` : route.method;
    case 'cache':
      return route.strategy;
    case 'redirect':
      return String(route.status ?? 302);
    case 'split-traffic':
      return route.variants.map((variant) => `${variant.name ?? 'variant'}:${variant.weight}`).join(',');
    case 'try-app':
      return `fallthrough:${route.fallthroughStatus.join(',')}`;
    default:
      return '';
  }
}

function routeTarget(route: AsyncRouteStep): string {
  switch (route.type) {
    case 'app':
      return route.app;
    case 'origin':
      return route.origin;
    case 'files':
      return route.filePrefix ?? route.publicPrefix ?? '/';
    case 'redirect':
      return route.url;
    case 'try-app':
      return `${route.candidates.length} candidates`;
    default:
      return '';
  }
}
