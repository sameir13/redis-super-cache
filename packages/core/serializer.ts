import { CacheSerializationError } from "./errors";

export interface Serializer {
  serialize(value: unknown): string;
  deserialize<T>(raw: string): T;
}

export const jsonSerializer: Serializer = {
  serialize(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch (err) {
      throw new CacheSerializationError("JSON serialization failed", err);
    }
  },
  deserialize<T>(raw: string): T {
    try {
      return JSON.parse(raw) as T;
    } catch (err) {
      throw new CacheSerializationError("JSON deserialization failed", err);
    }
  },
};

export interface CacheEnvelope<T = unknown> {
  __tc: 1;
  data: T;
}

export function wrapEnvelope<T>(value: T): CacheEnvelope<T> {
  return { __tc: 1, data: value };
}

export function unwrapEnvelope<T>(parsed: unknown): T {
  if (
    parsed !== null &&
    typeof parsed === "object" &&
    (parsed as CacheEnvelope).__tc === 1 &&
    "data" in (parsed as object)
  ) {
    return (parsed as CacheEnvelope<T>).data;
  }
  return parsed as T;
}
