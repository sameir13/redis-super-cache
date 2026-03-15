// Core
export { SuperCache, createCache } from "./cache";

// Tag invalidation (standalone helpers for advanced use)
export { invalidateTag, invalidateTags, addTagsToKey } from "./tags";

// Cache warmup
export { warmCache } from "./warmup";
export type { WarmupResult } from "./warmup";

// Prometheus metrics
export { metricsEndpoint, resetMetrics } from "./metrics";

// Types
export type {
  CacheOptions,
  CacheConfig,
  WarmTask,
  Logger,
} from "./types";

// Errors
export {
  CacheConnectionError,
  CacheCompressionError,
  CacheSerializationError,
} from "./errors";
