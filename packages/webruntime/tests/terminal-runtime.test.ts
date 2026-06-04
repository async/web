import { describe, expect, it } from 'vitest';
import { createMemoryFileSystem } from '../src/core/create-memory-file-system.ts';
import { createTerminalRuntime } from '../src/core/create-terminal-runtime.ts';

describe('terminal runtime', () => {
  it('runs built-in commands and notifies subscribers without throwing on unknown commands', async () => {
    const fs = createMemoryFileSystem({
      '/README.md': 'WebRuntime',
      '/src/index.ts': 'export {}'
    });
    let running = false;
    const terminal = createTerminalRuntime({
      fs,
      origin: 'http://localhost:3000',
      setRunning(value) {
        running = value;
      }
    });
    const chunks: string[] = [];
    const unsubscribe = terminal.subscribe((output) => {
      chunks.push(output);
    });

    await expect(terminal.run('ls /')).resolves.toMatchObject({
      exitCode: 0,
      output: '/README.md\n/src/index.ts'
    });
    await expect(terminal.run('cat /README.md')).resolves.toMatchObject({
      output: 'WebRuntime'
    });
    await expect(terminal.run('npm install')).resolves.toMatchObject({
      output: expect.stringContaining('added fake packages')
    });
    await expect(terminal.run('npm run dev')).resolves.toMatchObject({
      output: expect.stringContaining('Local: http://localhost:3000/')
    });
    expect(running).toBe(true);
    await expect(terminal.run('nope --flag')).resolves.toMatchObject({
      exitCode: 127,
      output: 'command not found: nope --flag'
    });
    expect(terminal.output()).toContain('WebRuntime');
    expect(chunks.length).toBeGreaterThan(0);

    terminal.clear();
    expect(terminal.output()).toBe('');

    unsubscribe();
    await terminal.run('help');
    expect(chunks.at(-1)).toBe('command not found: nope --flag');
  });

  it('runs registered commands and supports empty command output', async () => {
    const terminal = createTerminalRuntime({
      fs: createMemoryFileSystem(),
      origin: 'http://localhost:3000'
    });
    terminal.register('echo', (_command, args) => args.join(' '));
    terminal.register('noop', () => undefined);

    await expect(terminal.run('echo hello webRuntime')).resolves.toMatchObject({
      command: 'echo hello webRuntime',
      output: 'hello webRuntime'
    });
    await expect(terminal.run('noop')).resolves.toMatchObject({
      command: 'noop',
      output: ''
    });
  });
});
