import {
  host,
  method,
  mount,
  normalizeRoutes,
  printRouteTable,
  splitTraffic,
  toApp,
  tryApp,
  validateRoutes
} from '../src/index.ts';

describe('@async/router', () => {
  it('creates inspectable type-tagged route specs', () => {
    const routes = [
      mount('/api', toApp('api')),
      toApp('web')
    ];

    expect(routes[0]).toMatchObject({
      type: 'mount',
      path: '/api',
      to: [
        {
          type: 'app',
          app: 'api'
        }
      ]
    });
    expect(normalizeRoutes(routes)).toHaveLength(2);
  });

  it('keeps advanced routing pure and printable', () => {
    const routes = [
      host('admin.acme.async.run', toApp('admin')),
      method('GET', '/api/health', toApp('api')),
      splitTraffic([
        {
          name: 'stable',
          weight: 90,
          to: toApp('web')
        },
        {
          name: 'preview',
          weight: 10,
          to: toApp('preview')
        }
      ])
    ];

    expect(validateRoutes(routes)).toEqual([]);
    expect(printRouteTable(routes)).toContain('split-traffic');
    expect(printRouteTable(routes)).toContain('stable:90,preview:10');
  });

  it('uses config-first tryApp candidates for fallback routing', () => {
    const route = tryApp({}, [
      toApp('bff'),
      toApp('api')
    ]);

    expect(route).toEqual({
      type: 'try-app',
      fallthroughStatus: [
        404
      ],
      candidates: [
        {
          type: 'app',
          app: 'bff'
        },
        {
          type: 'app',
          app: 'api'
        }
      ]
    });
    expect(validateRoutes(route)).toEqual([]);
    expect(printRouteTable(route)).toContain('fallthrough:404');
  });
});
