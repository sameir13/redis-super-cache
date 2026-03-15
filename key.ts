import XXH from "xxhashjs";

/**
 * Hashes a cache key using xxHash64 to produce a short, consistent Redis key.
 *
 * @param key       - Raw cache key string (can be arbitrarily long)
 * @param prefix    - Namespace prefix (default: "sc")
 * @returns         - Hashed key e.g. "sc:1a2b3c4d5e6f7890"
 */
export function hashKey(key: string, prefix = "sc"): string {
  if (!key) {
    throw new RangeError("Cache key must be a non-empty string");
  }
  const hash = XXH.h64(key, 0xabcd).toString(16);
  return `${prefix}:${hash}`;
}
