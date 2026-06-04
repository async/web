const CONTENT_TYPES = new Map<string, string>([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.txt', 'text/plain; charset=utf-8']
]);

export function contentTypeForPath(path: string): string {
  const lower = path.toLowerCase();
  for (const [extension, contentType] of CONTENT_TYPES) {
    if (lower.endsWith(extension)) {
      return contentType;
    }
  }
  return 'application/octet-stream';
}
