import client, { Registry } from "prom-client";

export interface CacheMetrics {
  cacheHits: client.Counter<"key_prefix">;
  cacheMisses: client.Counter<"key_prefix">;
  cacheErrors: client.Counter<"operation" | "error_type">;
  cacheLatency: client.Histogram<"operation">;
  tagSize: client.Gauge<"tag">;
  registry: Registry;
}

const registryMetrics = new WeakMap<Registry, CacheMetrics>();

export function createMetrics(registry: Registry = client.register): CacheMetrics {
  const existing = registryMetrics.get(registry);
  if (existing) {
    return existing;
  }

  const metrics: CacheMetrics = {
    registry,
    cacheHits: new client.Counter({
      name: "redis_cache_hits_total",
      help: "Total number of cache hits",
      labelNames: ["key_prefix"] as const,
      registers: [registry],
    }),
    cacheMisses: new client.Counter({
      name: "redis_cache_misses_total",
      help: "Total number of cache misses",
      labelNames: ["key_prefix"] as const,
      registers: [registry],
    }),
    cacheErrors: new client.Counter({
      name: "redis_cache_errors_total",
      help: "Total number of cache errors",
      labelNames: ["operation", "error_type"] as const,
      registers: [registry],
    }),
    cacheLatency: new client.Histogram({
      name: "redis_cache_latency_ms",
      help: "Cache operation latency in milliseconds",
      labelNames: ["operation"] as const,
      buckets: [0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500],
      registers: [registry],
    }),
    tagSize: new client.Gauge({
      name: "redis_cache_tag_size",
      help: "Number of cache keys registered under each tag",
      labelNames: ["tag"] as const,
      registers: [registry],
    }),
  };

  registryMetrics.set(registry, metrics);
  return metrics;
}

const defaultMetrics = createMetrics();

export const cacheHits = defaultMetrics.cacheHits;
export const cacheMisses = defaultMetrics.cacheMisses;
export const cacheErrors = defaultMetrics.cacheErrors;
export const cacheLatency = defaultMetrics.cacheLatency;
export const tagSize = defaultMetrics.tagSize;

export async function metricsEndpoint(registry?: Registry): Promise<string> {
  return (registry ?? client.register).metrics();
}

export function resetMetrics(registry: Registry = client.register): void {
  registry.resetMetrics();
}
