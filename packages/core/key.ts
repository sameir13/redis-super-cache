import XXH from "xxhashjs";

export function hashKey(key: string, prefix = "tc"): string {
  if (!key) {
    throw new RangeError("Cache key must be a non-empty string");
  }
  const hash = XXH.h64(key, 0xabcd).toString(16);
  return `${prefix}:${hash}`;
}

export function metaKey(hashedKey: string): string {
  return `${hashedKey}:meta`;
}

export function tagKey(tag: string, keyPrefix: string): string {
  return `${keyPrefix}:tag:${tag}`;
}
