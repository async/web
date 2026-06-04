import type {
  FakeHistory,
  FakeHistoryEntry,
  FakeHistoryListener,
  FakeLocation
} from './types.ts';

export function createFakeHistory(location: FakeLocation): FakeHistory {
  let nextId = 1;
  let index = 0;
  let scrollRestoration: 'auto' | 'manual' = 'auto';
  const listeners = new Set<FakeHistoryListener>();
  const entries: FakeHistoryEntry[] = [
    createEntry(0, location.href, null)
  ];

  function createEntry(entryIndex: number, url: string, state: unknown): FakeHistoryEntry {
    const id = `history-${nextId++}`;
    return {
      id,
      key: id,
      index: entryIndex,
      url,
      state
    };
  }

  function reindex(): void {
    for (const [entryIndex, entry] of entries.entries()) {
      entry.index = entryIndex;
    }
  }

  function notify(): void {
    const entry = entries[index];
    if (!entry) {
      return;
    }
    for (const listener of listeners) {
      listener({ ...entry });
    }
  }

  function setCurrent(entryIndex: number): void {
    const entry = entries[entryIndex];
    if (!entry) {
      return;
    }
    index = entryIndex;
    location.assign(entry.url);
    notify();
  }

  const history: FakeHistory & {
    reset(url: string, state?: unknown): void;
  } = {
    get length() {
      return entries.length;
    },
    get state() {
      return entries[index]?.state;
    },
    get scrollRestoration() {
      return scrollRestoration;
    },
    set scrollRestoration(value) {
      scrollRestoration = value;
    },
    pushState(state, _unused, url) {
      const nextUrl = new URL(url ?? location.href, location.href).href;
      entries.splice(index + 1);
      entries.push(createEntry(entries.length, nextUrl, state));
      reindex();
      setCurrent(entries.length - 1);
    },
    replaceState(state, _unused, url) {
      const nextUrl = new URL(url ?? location.href, location.href).href;
      const current = entries[index];
      if (!current) {
        return;
      }
      entries[index] = {
        ...current,
        url: nextUrl,
        state
      };
      location.replace(nextUrl);
      notify();
    },
    back() {
      setCurrent(Math.max(0, index - 1));
    },
    forward() {
      setCurrent(Math.min(entries.length - 1, index + 1));
    },
    go(delta = 0) {
      setCurrent(Math.min(entries.length - 1, Math.max(0, index + delta)));
    },
    entries() {
      return entries.map((entry) => ({ ...entry }));
    },
    current() {
      const entry = entries[index];
      if (!entry) {
        throw new Error('WebRuntime history has no current entry');
      }
      return { ...entry };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reset(url, state = null) {
      index = 0;
      entries.length = 0;
      location.replace(url);
      entries.push(createEntry(0, location.href, state));
      notify();
    }
  };

  return history;
}
