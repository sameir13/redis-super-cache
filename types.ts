import type { RedisClientType } from "redis";

/**
 * Options accepted by cache.set() and cache.wrap()
 */
export interface CacheOptions {
  /** TTL in seconds. If omitted the key persists until manually deleted. */
  ttl?: number;
  /** Tag strings used for bulk invalidation via invalidateTag(). */
  tags?: string[];
}

/**
 * A single warmup task definition.
 */
export interface WarmTask<T = unknown> {
  key: string;
  worker: () => Promise<T>;
  ttl?: number;
  tags?: string[];
}

/**
 * Configuration passed to createCache().
 */
export interface CacheConfig {
  /**
   * A connected redis client (redis@4 RedisClientType).
   * The caller is responsible for connecting before passing it in.
   */
  client: RedisClientType;
  /**
   * Key namespace prefix. Defaults to "sc".
   */
  keyPrefix?: string;
  /**
   * Minimum byte length a value must reach before LZ4 compression is applied.
   * Defaults to 1024 bytes.
   */
  compressionThreshold?: number;
  /**
   * Logger interface. Defaults to console. Pass `false` to silence all logs.
   */
  logger?: Logger | false;
}

export interface Logger {
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}
