import { describe, expect, it } from 'vitest';
import { createMemoryFileSystem } from '../src/core/create-memory-file-system.ts';

describe('memory file system', () => {
  it('normalizes paths and stores deterministic string snapshots', async () => {
    const fs = createMemoryFileSystem({
      'index.html': '<h1>Home</h1>',
      '/public/app.js': 'console.log("ok");'
    });

    expect(await fs.readFile('index.html')).toBe('<h1>Home</h1>');
    expect(await fs.exists('/public/app.js')).toBe(true);
    expect(await fs.readdir()).toEqual(['/index.html', '/public/app.js']);
    expect(fs.snapshot()).toEqual({
      '/index.html': '<h1>Home</h1>',
      '/public/app.js': 'console.log("ok");'
    });
  });

  it('rejects path traversal', async () => {
    const fs = createMemoryFileSystem();

    await expect(fs.writeFile('../secret.txt', 'nope')).rejects.toThrow('Invalid WebRuntime path');
  });

  it('writes and deletes files', async () => {
    const fs = createMemoryFileSystem();

    await fs.writeFile('/notes/todo.txt', 'ship');
    expect(await fs.readFile('/notes/todo.txt')).toBe('ship');
    await fs.deleteFile('/notes/todo.txt');
    expect(await fs.exists('/notes/todo.txt')).toBe(false);
  });
});
