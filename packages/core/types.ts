import type { Registry } from "prom-client";
import type { RedisCacheClient } from "./client";
import type { Serializer } from "./serializer";

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
}

export interface WarmTask<T = unknown> {
  key: string;
  worker: () => Promise<T>;
  ttl?: number;
  tags?: string[];
  force?: boolean;
}

export interface CacheConfig {
  client: RedisCacheClient;
  keyPrefix?: string;
  namespace?: string;
  compressionThreshold?: number;
  stampedeProtection?: boolean;
  serializer?: Serializer;
  metricsRegistry?: Registry;
  logger?: Logger | false;
}

export interface Logger {
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}
