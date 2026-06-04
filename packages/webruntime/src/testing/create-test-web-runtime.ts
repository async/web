import { createWebRuntime } from '../core/create-web-runtime.ts';
import type { WebRuntime, WebRuntimeConfig } from '../core/types.ts';

export function createTestWebRuntime(config: WebRuntimeConfig): Promise<WebRuntime> {
  return createWebRuntime({
    ...config,
    delay: {
      enabled: false,
      ...config.delay
    }
  });
}
