import { describe, expect, it } from 'vitest';
import { createFakeLocation } from '../src/core/create-fake-location.ts';

describe('fake location', () => {
  it('resolves relative URLs against the current URL', () => {
    const location = createFakeLocation('http://localhost:3000/');

    location.assign('/about?x=1#top');

    expect(location.href).toBe('http://localhost:3000/about?x=1#top');
    expect(location.origin).toBe('http://localhost:3000');
    expect(location.protocol).toBe('http:');
    expect(location.host).toBe('localhost:3000');
    expect(location.hostname).toBe('localhost');
    expect(location.port).toBe('3000');
    expect(location.pathname).toBe('/about');
    expect(location.search).toBe('?x=1');
    expect(location.hash).toBe('#top');
    expect(location.toString()).toBe(location.href);
  });

  it('creates a Request for the current location', () => {
    const location = createFakeLocation('https://example.test/start');
    const request = location.toRequest({
      method: 'POST',
      body: 'hello'
    });

    expect(request.url).toBe('https://example.test/start');
    expect(request.method).toBe('POST');
  });

  it('throws clear errors for invalid URLs', () => {
    const location = createFakeLocation('http://localhost:3000/');

    expect(() => location.assign('http://[::1')).toThrow('Invalid WebRuntime URL');
  });
});
