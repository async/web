import type {
  FakeHistory,
  FakeHistoryEntry,
  FakeLocation,
  FakeNavigateEvent,
  FakeNavigation,
  FakeNavigationEventType,
  FakeNavigationHistoryEntry,
  FakeNavigationSimpleEvent,
  FakeNavigationOptions,
  FakeNavigationResult
} from './types.ts';

type AnyNavigationListener = (event: FakeNavigateEvent | FakeNavigationSimpleEvent) => void;

export function createFakeNavigation(
  location: FakeLocation,
  history: FakeHistory
): FakeNavigation {
  const listeners = new Map<FakeNavigationEventType, Set<AnyNavigationListener>>();

  function toNavigationEntry(entry: FakeHistoryEntry, sameDocument = false): FakeNavigationHistoryEntry {
    return {
      id: entry.id,
      key: entry.key,
      index: entry.index,
      url: entry.url,
      sameDocument,
      getState() {
        return entry.state;
      }
    };
  }

  function emit(type: FakeNavigationEventType, event: FakeNavigateEvent | FakeNavigationSimpleEvent): void {
    for (const listener of listeners.get(type) ?? []) {
      listener(event);
    }
  }

  function navigateTo(
    url: string,
    options: FakeNavigationOptions | undefined,
    mode: 'push' | 'replace' | 'traverse' | 'reload'
  ): FakeNavigationResult {
    let target: URL;
    try {
      target = new URL(url, location.href);
    } catch (error) {
      throw new Error(`Invalid WebRuntime navigation URL: ${url}`, {
        cause: error
      });
    }

    const handlers: Array<() => Promise<void> | void> = [];
    const sameDocument = target.origin === location.origin && target.pathname === location.pathname;
    const navigateEvent: FakeNavigateEvent = {
      type: 'navigate',
      destination: {
        url: target.href,
        sameDocument
      },
      canIntercept: true,
      userInitiated: options?.userInitiated ?? false,
      intercept(interceptOptions) {
        handlers.push(interceptOptions.handler);
      }
    };

    emit('navigate', navigateEvent);

    if (mode === 'replace' || mode === 'reload') {
      history.replaceState(options?.state ?? history.state, '', target.href);
    } else if (mode === 'push') {
      history.pushState(options?.state ?? null, '', target.href);
    }

    const entry = toNavigationEntry(history.current(), sameDocument);
    emit('currententrychange', {
      type: 'currententrychange'
    });

    const finished = (async () => {
      try {
        for (const handler of handlers) {
          await handler();
        }
        emit('navigatesuccess', {
          type: 'navigatesuccess'
        });
        return entry;
      } catch (error) {
        emit('navigateerror', {
          type: 'navigateerror',
          error
        });
        throw error;
      }
    })();

    return {
      committed: Promise.resolve(entry),
      finished
    };
  }

  return {
    get currentEntry() {
      return toNavigationEntry(history.current());
    },
    entries() {
      return history.entries().map((entry) => toNavigationEntry(entry));
    },
    navigate(url, options) {
      return navigateTo(url, options, 'push');
    },
    reload(options) {
      return navigateTo(location.href, options, 'reload');
    },
    traverseTo(key, options) {
      const entries = history.entries();
      const target = entries.find((entry) => entry.key === key);
      if (!target) {
        throw new Error(`WebRuntime navigation entry not found: ${key}`);
      }
      history.go(target.index - history.current().index);
      return navigateTo(target.url, options, 'traverse');
    },
    addEventListener(type, listener) {
      let bucket = listeners.get(type);
      if (!bucket) {
        bucket = new Set();
        listeners.set(type, bucket);
      }
      bucket.add(listener as AnyNavigationListener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener as AnyNavigationListener);
    }
  };
}
