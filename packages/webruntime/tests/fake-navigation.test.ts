import { describe, expect, it } from 'vitest';
import { createFakeHistory } from '../src/core/create-fake-history.ts';
import { createFakeLocation } from '../src/core/create-fake-location.ts';
import { createFakeNavigation } from '../src/core/create-fake-navigation.ts';

describe('fake navigation', () => {
  it('updates fake history and location and resolves committed before finished', async () => {
    const location = createFakeLocation('http://localhost:3000/');
    const history = createFakeHistory(location);
    const navigation = createFakeNavigation(location, history);
    const events: string[] = [];

    navigation.addEventListener('navigate', (event) => {
      events.push(`${event.type}:${new URL(event.destination.url).pathname}`);
      event.intercept({
        async handler() {
          events.push('intercept');
        }
      });
    });
    navigation.addEventListener('navigatesuccess', (event) => {
      events.push(event.type);
    });

    const result = navigation.navigate('/about');
    const committed = await result.committed;
    expect(new URL(committed.url).pathname).toBe('/about');
    expect(location.pathname).toBe('/about');

    await result.finished;
    expect(events).toEqual(['navigate:/about', 'intercept', 'navigatesuccess']);
  });

  it('emits navigateerror when an intercept handler fails', async () => {
    const location = createFakeLocation('http://localhost:3000/');
    const history = createFakeHistory(location);
    const navigation = createFakeNavigation(location, history);
    let errorEvent = '';

    navigation.addEventListener('navigate', (event) => {
      event.intercept({
        handler() {
          throw new Error('boom');
        }
      });
    });
    navigation.addEventListener('navigateerror', (event) => {
      errorEvent = event.type;
    });

    await expect(navigation.navigate('/broken').finished).rejects.toThrow('boom');
    expect(errorEvent).toBe('navigateerror');
  });
});
