export function normalizeWebRuntimePath(path: string): string {
  if (!path) {
    return '/';
  }

  const withoutQuery = path.split(/[?#]/, 1)[0] ?? '';
  const withForwardSlashes = withoutQuery.replaceAll('\\', '/');
  const parts = withForwardSlashes.split('/');
  const normalized: string[] = [];

  for (const part of parts) {
    if (!part || part === '.') {
      continue;
    }
    if (part === '..') {
      throw new Error(`Invalid WebRuntime path: ${path}`);
    }
    normalized.push(part);
  }

  return `/${normalized.join('/')}`;
}

export function joinWebRuntimePath(prefix: string, path: string): string {
  return normalizeWebRuntimePath(`${normalizeWebRuntimePath(prefix)}/${path}`);
}

export function pathnameFromRequest(request: Request): string {
  return normalizeWebRuntimePath(new URL(request.url).pathname);
}
