import { describe, expect, it } from 'vitest';
import { createNodeWebRuntime } from '../src/node/create-node-web-runtime.ts';
import { helloApp } from '../src/examples/hello-app/manifest.ts';

describe('node webRuntime e2e', () => {
  it('navigates through fake frontend, fake service worker, edge, and backend', async () => {
    const web = await createNodeWebRuntime({
      origin: 'http://localhost:3000',
      files: helloApp.files,
      app: helloApp.app,
      pipeline: {
        frontend: {
          kind: 'node-dom'
        },
        serviceWorker: {
          kind: 'fake'
        },
        network: {
          kind: 'blocked'
        },
        edge: {
          kind: 'bypass'
        },
        backend: {
          kind: 'fetch-app'
        }
      }
    });

    await web.frontend.navigate('/');
    expect(web.frontend.text('h1')).toBe('Home');
    await web.frontend.click('a[href="/about"]');
    expect(web.location.pathname).toBe('/about');
    expect(web.frontend.text('h1')).toBe('About');
    const response = await web.frontend.fetch('/api/time');
    const data = await response.json();
    expect(data.source).toBe('fake-node');
    const boundaries = web.trace.entries().map((entry) => entry.boundary);
    expect(boundaries).toContain('frontend:request');
    expect(boundaries).toContain('service-worker:request');
    expect(boundaries).toContain('backend:request');
  });

  it('submits GET and POST forms through the Node frontend', async () => {
    const web = await createNodeWebRuntime({
      origin: 'http://localhost:3000',
      app: {
        async fetch(request) {
          const url = new URL(request.url);
          if (url.pathname === '/') {
            return new Response(`
              <!doctype html>
              <html>
                <body>
                  <form id="get-form" action="/search" method="GET"></form>
                  <form id="post-form" action="/submit" method="POST"></form>
                </body>
              </html>
            `, {
              headers: {
                'content-type': 'text/html; charset=utf-8'
              }
            });
          }
          if (url.pathname === '/search') {
            return new Response(`<h1>${url.searchParams.get('q')}</h1>`, {
              headers: {
                'content-type': 'text/html; charset=utf-8'
              }
            });
          }
          return new Response(`<h1>${await request.text()}</h1>`, {
            headers: {
              'content-type': 'text/html; charset=utf-8'
            }
          });
        }
      },
      pipeline: {
        frontend: {
          kind: 'node-dom'
        },
        serviceWorker: {
          kind: 'bypass'
        },
        backend: {
          kind: 'fetch-app'
        }
      }
    });

    await web.frontend.navigate('/');
    await web.frontend.submit('#get-form', {
      q: 'webRuntime'
    });
    expect(web.location.pathname).toBe('/search');
    expect(web.frontend.text('h1')).toBe('webRuntime');

    await web.frontend.navigate('/');
    await web.frontend.submit('#post-form', {
      name: 'WebRuntime'
    });
    expect(web.location.pathname).toBe('/');
    expect(web.frontend.text('h1')).toBe('name=WebRuntime');
  });
});
