import { createHash } from 'node:crypto';

export type JsonPrimitive = boolean | number | string | null;
export type JsonObject = Record<string, JsonValue>;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;

function isPlainObject(value: object): value is Record<string, unknown> {
  return (
    Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null
  );
}

export function toJsonValue(value: unknown, path = '$'): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${path} must not contain a non-finite number.`);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      toJsonValue(entry, `${path}[${String(index)}]`),
    );
  }

  if (typeof value === 'object' && isPlainObject(value)) {
    const result: JsonObject = {};
    for (const key of Object.keys(value).sort()) {
      const child = value[key];
      if (child === undefined) {
        throw new TypeError(`${path}.${key} must not be undefined.`);
      }
      result[key] = toJsonValue(child, `${path}.${key}`);
    }
    return result;
  }

  throw new TypeError(`${path} must contain only JSON-compatible values.`);
}

export function toJsonObject(value: unknown, path = '$'): JsonObject {
  const parsed = toJsonValue(value, path);
  if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new TypeError(`${path} must be a JSON object.`);
  }
  return parsed;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(toJsonValue(value));
}

export function hashJson(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}
