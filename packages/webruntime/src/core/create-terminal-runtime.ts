import type {
  MemoryFileSystem,
  TerminalCommandHandler,
  TerminalOutputListener,
  TerminalResult,
  TerminalRuntime
} from './types.ts';

export function createTerminalRuntime(options: {
  fs: MemoryFileSystem;
  origin: string;
  setRunning?: (running: boolean) => void;
}): TerminalRuntime {
  const handlers = new Map<string, TerminalCommandHandler>();
  const listeners = new Set<TerminalOutputListener>();
  const lines: string[] = [];

  function append(value: string): void {
    if (value) {
      lines.push(value);
      for (const listener of listeners) {
        listener(value);
      }
    }
  }

  async function defaultHandler(command: string, args: string[]): Promise<TerminalResult> {
    if (command === 'ls') {
      const output = (await options.fs.readdir(args[0] ?? '/')).join('\n');
      return result(command, output);
    }
    if (command === 'cat') {
      const path = args[0];
      if (!path) {
        return result(command, 'usage: cat <file>', 1);
      }
      return result(command, await options.fs.readFile(path));
    }
    if (command === 'npm' && args.join(' ') === 'install') {
      return result(command, 'added fake packages\nfound 0 vulnerabilities');
    }
    if (command === 'npm' && args.join(' ') === 'run dev') {
      options.setRunning?.(true);
      return result(command, `WebRuntime dev server ready\nLocal: ${options.origin}/`);
    }
    if (command === 'node' && args[0] === 'server.js') {
      options.setRunning?.(true);
      return result(command, `WebRuntime node server ready\nLocal: ${options.origin}/`);
    }
    if (command === 'clear') {
      lines.length = 0;
      return result(command, '');
    }
    if (command === 'help') {
      return result(command, 'ls\ncat <file>\nnpm install\nnpm run dev\nnode server.js\nclear\nhelp');
    }
    return result(command, `command not found: ${[command, ...args].join(' ')}`, 127);
  }

  return {
    async run(input) {
      const [command = '', ...args] = input.trim().split(/\s+/);
      const handler = handlers.get(command);
      const value = handler
        ? await handler(command, args)
        : await defaultHandler(command, args);
      const terminalResult = normalizeResult(input, value);
      append(terminalResult.output);
      return terminalResult;
    },
    register(command, handler) {
      handlers.set(command, handler);
    },
    output() {
      return lines.join('\n');
    },
    clear() {
      lines.length = 0;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
  };
}

function normalizeResult(command: string, value: TerminalResult | string | void): TerminalResult {
  if (!value) {
    return result(command, '');
  }
  if (typeof value === 'string') {
    return result(command, value);
  }
  return value;
}

function result(command: string, output: string, exitCode = 0): TerminalResult {
  return {
    command,
    exitCode,
    output
  };
}
