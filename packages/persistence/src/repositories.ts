import type { JsonObject } from './json.js';
import { toJsonObject } from './json.js';

export * from './api-idempotency-repository.js';
export * from './driver-hos-repository.js';
export * from './export-history-repository.js';
export * from './regulatory-rule-repository.js';
export * from './route-provider-response-repository.js';
export * from './trip-revision-repository.js';
export * from './kpra-adjustment-repository.js';

export function snapshotObject(value: unknown): JsonObject {
  return toJsonObject(value);
}
export * from './equipment-profile-repository.js';
