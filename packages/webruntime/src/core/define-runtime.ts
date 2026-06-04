import type {
  FetchApp,
  WebRuntimeAppDefinition,
  WebRuntimeRegisteredAppConfig
} from './types.ts';

export interface WebRuntimeRegisteredAppInput extends Omit<WebRuntimeRegisteredAppConfig, 'app'> {
  app?: FetchApp;
  fetch?: FetchApp['fetch'];
}

export interface WebRuntimeAppDefinitionInput extends Omit<WebRuntimeAppDefinition, 'apps'> {
  apps: Record<string, WebRuntimeRegisteredAppInput>;
}

export function createWebRuntimeApp(definition: WebRuntimeAppDefinitionInput): WebRuntimeAppDefinition {
  return {
    ...definition,
    apps: Object.fromEntries(
      Object.entries(definition.apps).map(([name, app]) => [
        name,
        normalizeRegisteredApp(name, app)
      ])
    )
  };
}

function normalizeRegisteredApp(
  name: string,
  config: WebRuntimeRegisteredAppInput
): WebRuntimeRegisteredAppConfig {
  const { fetch, ...rest } = config;
  const app = config.app ?? (fetch ? { fetch } : undefined);
  if (!app) {
    throw new Error(`WebRuntime app requires a fetch handler: ${name}`);
  }
  return {
    ...rest,
    app
  };
}
