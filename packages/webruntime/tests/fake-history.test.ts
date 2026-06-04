import { describe, expect, it } from 'vitest';
import { createFakeHistory } from '../src/core/create-fake-history.ts';
import { createFakeLocation } from '../src/core/create-fake-location.ts';

describe('fake history', () => {
  it('pushes, replaces, and traverses entries while updating fake location', () => {
    const location = createFakeLocation('http://localhost:3000/');
    const history = createFakeHistory(location);
    const seen: string[] = [];
    history.subscribe((entry) => {
      seen.push(new URL(entry.url).pathname);
    });

    history.pushState({ page: 'about' }, '', '/about');
    history.pushState({ page: 'contact' }, '', '/contact');
    history.replaceState({ page: 'team' }, '', '/team');

    expect(history.length).toBe(3);
    expect(history.state).toEqual({ page: 'team' });
    expect(location.pathname).toBe('/team');

    history.back();
    expect(location.pathname).toBe('/about');
    history.forward();
    expect(location.pathname).toBe('/team');
    history.go(-2);
    expect(location.pathname).toBe('/');
    expect(seen).toEqual(['/about', '/contact', '/team', '/about', '/team', '/']);
  });

  it('truncates forward entries after pushState', () => {
    const location = createFakeLocation('http://localhost:3000/');
    const history = createFakeHistory(location);

    history.pushState(null, '', '/one');
    history.pushState(null, '', '/two');
    history.back();
    history.pushState(null, '', '/three');

    expect(history.entries().map((entry) => new URL(entry.url).pathname)).toEqual(['/', '/one', '/three']);
    expect(history.current().index).toBe(2);
  });
});
