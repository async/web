import type { WebRuntime, WebRuntimeTraceEntry } from '../core/types.ts';

export function traceBoundaries(web: WebRuntime): WebRuntimeTraceEntry['boundary'][] {
  return web.trace.entries().map((entry) => entry.boundary);
}

export function hasTraceBoundary(web: WebRuntime, boundary: WebRuntimeTraceEntry['boundary']): boolean {
  return traceBoundaries(web).includes(boundary);
}
