import type { WebRuntimeCookieJar } from '../types.ts';

interface CookieEntry {
  name: string;
  value: string;
  origin: string;
  path: string;
}

export function createWebRuntimeCookieJar(): WebRuntimeCookieJar {
  const entries = new Map<string, CookieEntry>();

  return {
    getCookieHeader(url) {
      const requestUrl = new URL(url);
      return [...entries.values()]
        .filter((entry) => entry.origin === requestUrl.origin && requestUrl.pathname.startsWith(entry.path))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((entry) => `${entry.name}=${entry.value}`)
        .join('; ');
    },
    setCookie(url, value) {
      const values = Array.isArray(value) ? value : [value];
      for (const cookie of values) {
        applySetCookie(entries, new URL(url), cookie);
      }
    },
    deleteCookie(url, name) {
      const requestUrl = new URL(url);
      for (const [key, entry] of entries) {
        if (entry.origin === requestUrl.origin && entry.name === name) {
          entries.delete(key);
        }
      }
    },
    clear() {
      entries.clear();
    },
    snapshot() {
      return Object.fromEntries(
        [...entries.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, entry]) => [key, `${entry.name}=${entry.value}`])
      );
    }
  };
}

function applySetCookie(entries: Map<string, CookieEntry>, requestUrl: URL, cookie: string): void {
  const [pair, ...attributes] = cookie.split(';').map((part) => part.trim());
  const separator = pair?.indexOf('=') ?? -1;
  if (!pair || separator <= 0) {
    return;
  }

  const name = pair.slice(0, separator);
  const value = pair.slice(separator + 1);
  const path = normalizePath(attributeValue(attributes, 'path') ?? defaultCookiePath(requestUrl.pathname));
  const maxAge = attributeValue(attributes, 'max-age');
  const key = `${requestUrl.origin}|${path}|${name}`;

  if (value === '' || maxAge === '0') {
    entries.delete(key);
    return;
  }

  entries.set(key, {
    name,
    value,
    origin: requestUrl.origin,
    path
  });
}

function attributeValue(attributes: string[], name: string): string | undefined {
  const prefix = `${name.toLowerCase()}=`;
  const attribute = attributes.find((candidate) => candidate.toLowerCase().startsWith(prefix));
  return attribute?.slice(prefix.length);
}

function defaultCookiePath(pathname: string): string {
  if (!pathname.startsWith('/')) {
    return '/';
  }
  const index = pathname.lastIndexOf('/');
  return index <= 0 ? '/' : pathname.slice(0, index + 1);
}

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}
