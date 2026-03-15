import client from "prom-client";

/**
 * Total cache hits (get returned a value).
 */
export const cacheHits = new client.Counter({
  name: "redis_cache_hits_total",
  help: "Total number of cache hits",
  labelNames: ["key_prefix"] as const,
});

/**
 * Total cache misses (get returned null).
 */
export const cacheMisses = new client.Counter({
  name: "redis_cache_misses_total",
  help: "Total number of cache misses",
  labelNames: ["key_prefix"] as const,
});

/**
 * Total cache errors (Redis, compression, or serialization failures).
 */
export const cacheErrors = new client.Counter({
  name: "redis_cache_errors_total",
  help: "Total number of cache errors",
  labelNames: ["operation", "error_type"] as const,
});

/**
 * Latency histogram for get/set/del operations (milliseconds).
 */
export const cacheLatency = new client.Histogram({
  name: "redis_cache_latency_ms",
  help: "Cache operation latency in milliseconds",
  labelNames: ["operation"] as const,
  buckets: [0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500],
});

/**
 * Number of keys currently tracked per tag (gauge).
 */
export const tagSize = new client.Gauge({
  name: "redis_cache_tag_size",
  help: "Number of cache keys registered under each tag",
  labelNames: ["tag"] as const,
});

/**
 * Returns the Prometheus text exposition format for scraping.
 */
export async function metricsEndpoint(): Promise<string> {
  return client.register.metrics();
}

/**
 * Resets all metrics — useful in tests to avoid cross-test pollution.
 */
export function resetMetrics(): void {
  client.register.resetMetrics();
}
