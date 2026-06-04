export type WebRuntimeProviderName =
  | 'cloudflare'
  | 'imperva'
  | 'fly'
  | 'node'
  | 'static'
  | 'async-cloud'
  | (string & {});

export interface WebRuntimeProviderPlacement {
  provider: WebRuntimeProviderName;
  runtime?: string;
  region?: string;
  cacheStore?: string;
  readPolicy?: 'same-region' | 'nearest-edge' | 'origin';
  writePolicy?: 'same-region' | 'origin';
  fallback?: 'edge' | 'origin' | 'static';
}

export interface WebRuntimeProviderHookContext {
  placement: WebRuntimeProviderPlacement;
  request: Request;
}

export type WebRuntimeProviderHook = (
  context: WebRuntimeProviderHookContext
) => Promise<Response | undefined> | Response | undefined;

export interface WebRuntimeProviderDefinition {
  name: WebRuntimeProviderName;
  route?: WebRuntimeProviderHook;
}

export function defineProvider(provider: WebRuntimeProviderDefinition): WebRuntimeProviderDefinition {
  return provider;
}

