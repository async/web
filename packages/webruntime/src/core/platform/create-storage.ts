import type { WebRuntimeStorageArea } from '../types.ts';

export function createWebRuntimeStorageArea(): WebRuntimeStorageArea {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    key(index) {
      return [...entries.keys()].sort()[index] ?? null;
    },
    getItem(key) {
      return entries.get(String(key)) ?? null;
    },
    setItem(key, value) {
      entries.set(String(key), String(value));
    },
    removeItem(key) {
      entries.delete(String(key));
    },
    clear() {
      entries.clear();
    },
    snapshot() {
      return Object.fromEntries([...entries.entries()].sort(([a], [b]) => a.localeCompare(b)));
    }
  };
}
