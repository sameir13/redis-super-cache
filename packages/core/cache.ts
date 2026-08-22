import type { RedisCacheClient } from "./client";
import { compress, decompress } from "./compression";
import {
  CacheConnectionError,
  CacheSerializationError,
} from "./errors";
import { hashKey, metaKey, tagKey } from "./key";
import { createMetrics, type CacheMetrics } from "./metrics";
import {
  jsonSerializer,
  unwrapEnvelope,
  wrapEnvelope,
  type Serializer,
} from "./serializer";
import {
  addTagsToKey,
  cleanupTag,
  invalidateTag,
  invalidateTags,
  removeKeyFromTags,
} from "./tags";
import type { CacheConfig, CacheOptions, Logger } from "./types";

interface CacheResolveResult<T> {
  hit: boolean;
  value: T | null;
}

export class TagCache {
  private readonly client: RedisCacheClient;
  private readonly keyPrefix: string;
  private readonly compressionThreshold: number;
  private readonly stampedeProtection: boolean;
  private readonly serializer: Serializer;
  private readonly metrics: CacheMetrics;
  private readonly logger: Logger | false;
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(config: CacheConfig) {
    this.client = config.client;
    const namespace = config.namespace ? `${config.namespace}:` : "";
    const prefix = config.keyPrefix ?? "tc";
    this.keyPrefix = `${namespace}${prefix}`;
    this.compressionThreshold = config.compressionThreshold ?? 1024;
    this.stampedeProtection = config.stampedeProtection ?? true;
    this.serializer = config.serializer ?? jsonSerializer;
    this.metrics = createMetrics(config.metricsRegistry);
    this.logger = config.logger === undefined ? console : config.logger;
  }

  get prefix(): string {
    return this.keyPrefix;
  }

  async exists(key: string): Promise<boolean> {
    const hk = hashKey(key, this.keyPrefix);
    try {
      return (await this.client.exists(hk)) > 0;
    } catch (err) {
      this.handleError("exists", err);
      return false;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const resolved = await this.resolve<T>(key);
    return resolved.hit ? resolved.value : null;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const end = this.metrics.cacheLatency.startTimer({ operation: "set" });
    const hk = hashKey(key, this.keyPrefix);

    let json: string;
    try {
      json = this.serializer.serialize(wrapEnvelope(value));
    } catch (err) {
      end();
      if (err instanceof CacheSerializationError) throw err;
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
      throw err;
    }

    try {
      const pipeline = this.client.multi();

      if (options?.ttl !== undefined && options.ttl > 0) {
        pipeline.set(hk, payload, { EX: options.ttl });
      } else {
        pipeline.set(hk, payload);
      }

      if (options?.tags && options.tags.length > 0) {
        for (const tag of options.tags) {
          pipeline.sAdd(tagKey(tag, this.keyPrefix), hk);
        }
        for (const tag of options.tags) {
          pipeline.sAdd(metaKey(hk), tag);
        }
      }

      await pipeline.exec();

      if (options?.tags) {
        for (const tag of options.tags) {
          this.client
            .sCard(tagKey(tag, this.keyPrefix))
            .then((size) => this.metrics.tagSize.labels({ tag }).set(size))
            .catch(() => undefined);
        }
      }
    } catch (err) {
      end();
      throw new CacheConnectionError(`Failed to write key "${key}" to Redis`, err);
    }

    end();
  }

  async del(key: string): Promise<void> {
    const end = this.metrics.cacheLatency.startTimer({ operation: "del" });
    const hk = hashKey(key, this.keyPrefix);

    try {
      await removeKeyFromTags(this.client, hk, this.keyPrefix, this.metrics);
      await this.client.del(hk);
    } catch (err) {
      end();
      throw new CacheConnectionError(`Failed to delete key "${key}"`, err);
    }

    end();
  }

  async wrap<T>(
    key: string,
    fn: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    if (this.stampedeProtection) {
      const existing = this.inflight.get(key);
      if (existing) {
        return existing as Promise<T>;
      }
    }

    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    if (this.stampedeProtection) {
      this.inflight.set(key, promise);
    }

    void this.runWrap(key, fn, options)
      .then(resolve)
      .catch(reject)
      .finally(() => {
        if (this.stampedeProtection) {
          this.inflight.delete(key);
        }
      });

    return promise;
  }

  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    const end = this.metrics.cacheLatency.startTimer({ operation: "mget" });
    const result = new Map<string, T | null>();

    if (keys.length === 0) {
      end();
      return result;
    }

    try {
      const hashed = keys.map((key) => ({
        key,
        hk: hashKey(key, this.keyPrefix),
      }));

      const values = await Promise.all(
        hashed.map(({ hk }) => this.client.getBuffer(hk))
      );

      for (let i = 0; i < hashed.length; i++) {
        const { key } = hashed[i]!;
        const raw = values[i];

        if (raw === null || raw === undefined) {
          this.metrics.cacheMisses.labels({ key_prefix: this.keyPrefix }).inc();
          result.set(key, null);
          continue;
        }

        try {
          const json = decompress(raw);
          const parsed = this.serializer.deserialize<unknown>(json);
          this.metrics.cacheHits.labels({ key_prefix: this.keyPrefix }).inc();
          result.set(key, unwrapEnvelope<T>(parsed));
        } catch (err) {
          this.handleError("mget", err);
          result.set(key, null);
        }
      }
    } catch (err) {
      this.handleError("mget", err);
      for (const key of keys) {
        result.set(key, null);
      }
    }

    end();
    return result;
  }

  async mset<T>(
    entries: Array<{ key: string; value: T; options?: CacheOptions }>
  ): Promise<void> {
    const end = this.metrics.cacheLatency.startTimer({ operation: "mset" });

    try {
      for (const entry of entries) {
        await this.set(entry.key, entry.value, entry.options);
      }
    } finally {
      end();
    }
  }

  async invalidateTag(tag: string): Promise<number> {
    return invalidateTag(this.client, tag, this.keyPrefix, this.metrics);
  }

  async invalidateTags(tags: string[]): Promise<number> {
    return invalidateTags(this.client, tags, this.keyPrefix, this.metrics);
  }

  async addTagsToKey(key: string, tags: string[]): Promise<void> {
    const hk = hashKey(key, this.keyPrefix);
    await addTagsToKey(this.client, hk, tags, this.keyPrefix, this.metrics);
  }

  async cleanupTag(tag: string): Promise<number> {
    return cleanupTag(this.client, tag, this.keyPrefix, this.metrics);
  }

  private async runWrap<T>(
    key: string,
    fn: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const resolved = await this.resolve<T>(key);
    if (resolved.hit) {
      return resolved.value as T;
    }

    const result = await fn();
    await this.set(key, result, options);
    return result;
  }

  private async resolve<T>(key: string): Promise<CacheResolveResult<T>> {
    const end = this.metrics.cacheLatency.startTimer({ operation: "get" });
    const hk = hashKey(key, this.keyPrefix);

    try {
      const raw = await this.client.getBuffer(hk);

      if (raw === null) {
        this.metrics.cacheMisses.labels({ key_prefix: this.keyPrefix }).inc();
        return { hit: false, value: null };
      }

      const json = decompress(raw);
      const parsed = this.serializer.deserialize<unknown>(json);
      this.metrics.cacheHits.labels({ key_prefix: this.keyPrefix }).inc();
      return { hit: true, value: unwrapEnvelope<T>(parsed) };
    } catch (err) {
      this.handleError("get", err);
      return { hit: false, value: null };
    } finally {
      end();
    }
  }

  private handleError(operation: string, err: unknown): void {
    const errorType =
      err instanceof Error ? err.constructor.name : "UnknownError";

    this.metrics.cacheErrors.labels({ operation, error_type: errorType }).inc();

    if (this.logger) {
      this.logger.warn(
        `[redis-super-cache] ${operation} error (${errorType}):`,
        err
      );
    }
  }
}

/** @deprecated Use TagCache instead */
export const SuperCache = TagCache;

export function createTagCache(config: CacheConfig): TagCache {
  return new TagCache(config);
}

/** @deprecated Use createTagCache instead */
export function createCache(config: CacheConfig): TagCache {
  return createTagCache(config);
}
