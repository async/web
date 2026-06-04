import {
  createWebRuntime,
  createWebRuntimeContext
} from './core/create-web-runtime.ts';
import { createWebRuntimeApp as defineWebRuntimeApp } from './core/define-runtime.ts';
import type {
  FetchApp,
  WebRuntimeAppDefinition
} from './core/types.ts';
import { createWebRuntimePlatform } from './core/platform/create-platform.ts';

export type WebRuntimeDefinition = WebRuntimeAppDefinition;
export type WebRuntimeFetchApp = FetchApp;
export type {
  WebRuntimeAppDefinitionInput,
  WebRuntimeRegisteredAppInput
} from './core/define-runtime.ts';
export type {
  WebRuntime,
  WebRuntimeConfig,
  WebRuntimeContext,
  WebRuntimeCreateOptions,
  WebRuntimeEnv,
  WebRuntimeMiddleware,
  WebRuntimePlatform,
  WebRuntimeRegisteredAppConfig,
  WebRuntimeRouteContext
} from './core/types.ts';

export {
  createWebRuntime,
  createWebRuntimeContext
};
export const defineRuntime = defineWebRuntimeApp;
export const createWebRuntimeApp = defineWebRuntimeApp;
export const createPlatform = createWebRuntimePlatform;

export function createFetchApp(fetch: FetchApp['fetch']): FetchApp {
  return {
    fetch
  };
}
