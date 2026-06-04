import { describe, expect, it } from 'vitest';
import { createWebRuntime } from '../src/core/create-web-runtime.ts';

describe('webRuntime reset', () => {
  it('restores filesystem, navigation state, terminal output, trace, and edge cache', async () => {
    const web = await createWebRuntime({
      origin: 'http://localhost:3000',
      files: {
        '/server.js': 'export default {}'
      },
      app: {
        fetch() {
          return new Response('ok', {
            headers: {
              'cache-control': 's-maxage=60'
            }
          });
        }
      },
      pipeline: {
        frontend: {
          kind: 'headless'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        edge: {
          kind: 'fake',
          cache: {
            enabled: true,
            defaultTtl: 60
          }
        },
        backend: {
          kind: 'fetch-app'
        }
      }
    });

    await web.navigate('/about');
    await web.fs.writeFile('/tmp.txt', 'temporary');
    await web.terminal.run('npm install');
    await web.fetch('/');

    expect(web.location.pathname).toBe('/about');
    expect(web.history.length).toBe(2);
    expect(web.terminal.output()).toContain('added fake packages');
    expect((await web.edge.cache.keys()).length).toBeGreaterThan(0);
    expect(web.trace.entries().length).toBeGreaterThan(0);

    await web.reset();

    expect(web.location.href).toBe('http://localhost:3000/');
    expect(web.history.length).toBe(1);
    expect(web.history.current().url).toBe('http://localhost:3000/');
    expect(web.navigation.currentEntry.url).toBe('http://localhost:3000/');
    expect(web.terminal.output()).toBe('');
    expect(await web.edge.cache.keys()).toHaveLength(0);
    expect(web.trace.entries()).toEqual([]);
    expect(web.fs.snapshot()).toEqual({
      '/server.js': 'export default {}'
    });
  });
});
