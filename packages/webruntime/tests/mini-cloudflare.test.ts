import { describe, expect, it } from 'vitest';
import {
  createMiniCloudflareDeployment,
  type MiniCloudflareAssetsBinding,
  type MiniCloudflareD1Database,
  type MiniCloudflareEnv,
  type MiniCloudflareKVNamespace,
  type MiniCloudflareR2Bucket
} from '../src/providers/mini-cloudflare.ts';
import { serveMiniCloudflareDeployment } from '../src/node/create-mini-cloudflare-preview-server.ts';

interface TestCloudflareEnv extends MiniCloudflareEnv {
  ASSETS: MiniCloudflareAssetsBinding;
  KV: MiniCloudflareKVNamespace;
  R2: MiniCloudflareR2Bucket;
  DB: MiniCloudflareD1Database;
  RELEASE: string;
}

describe('mini Cloudflare provider', () => {
  it('runs a Cloudflare-shaped Worker deployment through WebRuntime', async () => {
    const deployment = await createMiniCloudflareDeployment<TestCloudflareEnv>({
      id: 'deployment_ABC_123',
      vars: {
        RELEASE: 'canary'
      },
      assets: {
        '/index.html': '<!doctype html><h1>Mini Cloudflare</h1>',
        '/assets/app.js': 'console.log("mini-cloudflare")'
      },
      kv: {
        KV: {
          feature: '{"enabled":true}'
        }
      },
      r2: {
        R2: {}
      },
      d1: {
        DB: {
          'select count(*) as count from deployments': {
            results: [{ count: 1 }]
          }
        }
      },
      region: 'iad',
      worker: {
        async fetch(request, env, context) {
          const url = new URL(request.url);
          if (url.pathname === '/api/status') {
            const feature = await env.KV.get('feature', 'json');
            const deploymentCount = await env.DB
              .prepare('select count(*) as count from deployments')
              .first<{ count: number }>();
            context.waitUntil(env.R2.put('events/api-status.json', JSON.stringify({
              pathname: url.pathname
            })));
            return Response.json({
              release: env.RELEASE,
              feature,
              deploymentCount: deploymentCount?.count,
              region: context.region
            });
          }

          const cached = await context.caches.default.match(request);
          if (cached) {
            const headers = new Headers(cached.headers);
            headers.set('x-mini-cache', 'hit');
            return new Response(cached.body, {
              status: cached.status,
              headers
            });
          }

          const response = await env.ASSETS.fetch(request);
          if (!response.ok) {
            return response;
          }
          const headers = new Headers(response.headers);
          headers.set('x-mini-cache', 'miss');
          const visibleResponse = new Response(response.body, {
            status: response.status,
            headers
          });
          context.waitUntil(context.caches.default.put(request, visibleResponse.clone()));
          return visibleResponse;
        }
      }
    });

    expect(deployment.id).toBe('deployment-abc-123');
    expect(deployment.previewUrl).toBe('https://deployment-abc-123.preview.async.local/');
    expect(deployment.manifest()).toEqual({
      provider: 'mini-cloudflare',
      deploymentId: 'deployment-abc-123',
      previewUrl: 'https://deployment-abc-123.preview.async.local/',
      region: 'iad',
      bindings: {
        assets: ['/assets/app.js', '/index.html'],
        kv: ['KV'],
        r2: ['R2'],
        d1: ['DB']
      }
    });

    const firstHome = await deployment.fetch('/');
    expect(firstHome.headers.get('x-mini-cache')).toBe('miss');
    await expect(firstHome.text()).resolves.toContain('Mini Cloudflare');
    await deployment.waitUntil();

    const secondHome = await deployment.fetch('/');
    expect(secondHome.headers.get('x-mini-cache')).toBe('hit');
    await expect(secondHome.text()).resolves.toContain('Mini Cloudflare');

    const status = await deployment.fetch('/api/status');
    await expect(status.json()).resolves.toEqual({
      release: 'canary',
      feature: {
        enabled: true
      },
      deploymentCount: 1,
      region: 'iad'
    });
    await deployment.waitUntil();

    const event = await deployment.env.R2.get('events/api-status.json');
    expect(event).not.toBeNull();
    await expect(event?.json()).resolves.toEqual({
      pathname: '/api/status'
    });

    expect(deployment.web.trace.entries().map((entry) => entry.boundary)).toContain('edge:request');
  });

  it('serves a mini Cloudflare deployment on a local HTTP preview URL', async () => {
    const deployment = await createMiniCloudflareDeployment({
      id: 'local-preview',
      assets: {
        '/index.html': '<!doctype html><title>Local preview</title>'
      }
    });
    const server = await serveMiniCloudflareDeployment(deployment, {
      basePath: '/preview/local-preview'
    });

    try {
      expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/preview\/local-preview\/$/);
      const response = await fetch(server.url);
      expect(response.status).toBe(200);
      await expect(response.text()).resolves.toContain('Local preview');
    } finally {
      await server.close();
    }
  });
});
