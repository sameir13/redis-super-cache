import type { RedisClientType } from "redis";
import { hashKey } from "./key";
import { compress, decompress } from "./compression";
import { addTagsToKey, invalidateTag, invalidateTags } from "./tags";
import {
  cacheHits,
  cacheMisses,
  cacheErrors,
  cacheLatency,
} from "./metrics";
import {
  CacheConnectionError,
  CacheSerializationError,
} from "./errors";
import type { CacheConfig, CacheOptions, Logger } from "./types";

/**
 * Production-grade Redis cache with:
 *  - xxHash64 key hashing
 *  - LZ4 compression with header-based safe decompression
 *  - Redis pipeline batching for set+tag registration
 *  - Tag-based bulk invalidation
 *  - Prometheus metrics (hits, misses, errors, latency)
 *  - Full error handling — get() never throws; set/del surface errors explicitly
 *
 * Create an instance via the exported `createCache()` factory.
 */
export class SuperCache {
  private readonly client: RedisClientType;
  private readonly keyPrefix: string;
  private readonly compressionThreshold: number;
  private readonly logger: Logger | false;

  constructor(config: CacheConfig) {
    this.client = config.client;
    this.keyPrefix = config.keyPrefix ?? "sc";
    this.compressionThreshold = config.compressionThreshold ?? 1024;
    this.logger = config.logger === undefined ? console : config.logger;
  }

  // ─── GET ───────────────────────────────────────────────────────────────────

  /**
   * Retrieves and deserializes a cached value.
   * Returns `null` on miss OR on any error — get() is intentionally safe.
   * Errors are logged and counted in Prometheus but never re-thrown so a
   * broken Redis connection never crashes the caller's request path.
   */
  async get<T>(key: string): Promise<T | null> {
    const end = cacheLatency.startTimer({ operation: "get" });
    const hk = hashKey(key, this.keyPrefix);

    try {
      const raw = await (this.client as any).getBuffer(hk);

      if (raw === null) {
        cacheMisses.labels({ key_prefix: this.keyPrefix }).inc();
        return null;
      }

      const json = decompress(raw);
      const value = JSON.parse(json) as T;

      cacheHits.labels({ key_prefix: this.keyPrefix }).inc();
      return value;
    } catch (err) {
      this.handleError("get", err);
      return null;
    } finally {
      end();
    }
  }

  // ─── SET ───────────────────────────────────────────────────────────────────

  /**
   * Serializes, compresses, and stores a value.
   * If tags are provided, registers the hashed key under each tag in a single
   * pipeline call (no extra round trips).
   *
   * @throws {CacheSerializationError}  If JSON.stringify fails.
   * @throws {CacheConnectionError}     If the Redis write or tag registration fails.
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const end = cacheLatency.startTimer({ operation: "set" });
    const hk = hashKey(key, this.keyPrefix);

    let json: string;
    try {
      json = JSON.stringify(value);
    } catch (err) {
      end();
      throw new CacheSerializationError(
        `Failed to serialize value for key "${key}"`,
        err
      );
    }

    let payload: Buffer;
    try {
      payload = compress(json, this.compressionThreshold);
    } catch (err) {
      end();
      throw err; // CacheCompressionError already typed
    }

    try {
      // Batch the set + tag registrations in one pipeline
      const pipeline = this.client.multi();

      if (options?.ttl !== undefined && options.ttl > 0) {
        pipeline.set(hk, payload, { EX: options.ttl });
      } else {
        pipeline.set(hk, payload);
      }

      // Register tags inside the same pipeline
      if (options?.tags && options.tags.length > 0) {
        for (const tag of options.tags) {
          pipeline.sAdd(`tag:${tag}`, hk);
        }
      }

      await pipeline.exec();
    } catch (err) {
      end();
      throw new CacheConnectionError(`Failed to write key "${key}" to Redis`, err);
    }

    end();
  }

  // ─── DELETE ────────────────────────────────────────────────────────────────

  /**
   * Deletes a single key by its original (pre-hash) name.
   *
   * @throws {CacheConnectionError} If the Redis DEL command fails.
   */
  async del(key: string): Promise<void> {
    const end = cacheLatency.startTimer({ operation: "del" });
    const hk = hashKey(key, this.keyPrefix);

    try {
      await this.client.del(hk);
    } catch (err) {
      end();
      throw new CacheConnectionError(`Failed to delete key "${key}"`, err);
    }

    end();
  }

  // ─── WRAP ──────────────────────────────────────────────────────────────────

  /**
   * Returns the cached value if it exists; otherwise calls `fn`, stores its
   * result, and returns it. This is the primary "cache-aside" helper.
   *
   * @throws Whatever `fn` throws — this method does not swallow compute errors.
   */
  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const result = await fn(); // let fn errors propagate naturally
    await this.set(key, result, options);
    return result;
  }

  // ─── INVALIDATION ──────────────────────────────────────────────────────────

  /**
   * Invalidates all keys registered under a tag.
   *
   * @returns Number of keys deleted.
   * @throws {CacheConnectionError}
   */
  async invalidateTag(tag: string): Promise<number> {
    return invalidateTag(this.client, tag);
  }

  /**
   * Invalidates multiple tags in parallel.
   *
   * @returns Total keys deleted across all tags.
   */
  async invalidateTags(tags: string[]): Promise<number> {
    return invalidateTags(this.client, tags);
  }

  // ─── TAG HELPERS (re-exported for direct use) ─────────────────────────────

  /**
   * Manually registers a hashed key under one or more tags.
   * Normally called automatically by set() — use this only for advanced cases.
   */
  async addTagsToKey(key: string, tags: string[]): Promise<void> {
    const hk = hashKey(key, this.keyPrefix);
    await addTagsToKey(this.client, hk, tags);
  }

  // ─── INTERNAL ─────────────────────────────────────────────────────────────

  private handleError(operation: string, err: unknown): void {
    const errorType =
      err instanceof Error ? err.constructor.name : "UnknownError";

    cacheErrors.labels({ operation, error_type: errorType }).inc();

    if (this.logger) {
      this.logger.warn(
        `[redis-super-cache] ${operation} error (${errorType}):`,
        err
      );
    }
  }
}

/**
 * Factory function — the recommended way to create a SuperCache instance.
 *
 * @example
 * ```ts
 * import { createClient } from "redis";
 * import { createCache } from "redis-super-cache";
 *
 * const redis = createClient({ url: process.env.REDIS_URL });
 * await redis.connect();
 *
 * export const cache = createCache({ client: redis });
 * ```
 */
export function createCache(config: CacheConfig): SuperCache {
  return new SuperCache(config);
}
