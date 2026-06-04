import type {
  WebRuntimeTraceEntry,
  PipelineTraceController,
  PipelineTraceListener
} from './types.ts';

export function createPipelineTracer(): PipelineTraceController {
  let nextId = 1;
  const log: WebRuntimeTraceEntry[] = [];
  const listeners = new Set<PipelineTraceListener>();

  function record(
    entry: Omit<WebRuntimeTraceEntry, 'id' | 'timestamp'> & {
      id?: string;
      timestamp?: number;
    }
  ): WebRuntimeTraceEntry {
    const fullEntry: WebRuntimeTraceEntry = {
      ...entry,
      id: entry.id ?? `trace-${nextId++}`,
      timestamp: entry.timestamp ?? Date.now()
    };

    log.push(fullEntry);
    for (const listener of listeners) {
      listener(fullEntry);
    }
    return fullEntry;
  }

  return {
    record,
    entries() {
      return [...log];
    },
    clear() {
      log.length = 0;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}
