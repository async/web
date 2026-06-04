import { createWebRuntime } from '../core/create-web-runtime.ts';
import type { WebRuntime, WebRuntimeConfig } from '../core/types.ts';
import { createNodeFrontend, type NodeFrontend } from './create-node-frontend.ts';

export type NodeWebRuntime = Omit<WebRuntime, 'frontend'> & {
  readonly frontend: NodeFrontend;
};

export async function createNodeWebRuntime(config: WebRuntimeConfig): Promise<NodeWebRuntime> {
  const web = await createWebRuntime(config);
  const frontend = createNodeFrontend(web);

  return {
    ...web,
    frontend
  };
}
