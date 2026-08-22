export { TagCacheModule } from "./tag-cache.module";
export type {
  TagCacheModuleOptions,
  TagCacheModuleAsyncOptions,
  TagCacheRedisOptions,
} from "./tag-cache.module";
export { TAG_CACHE, TAG_CACHE_MODULE_OPTIONS } from "./tag-cache.constants";
export { InjectTagCache, InjectSuperCache } from "./inject-tag-cache.decorator";
export {
  Cacheable,
  CacheEvict,
  CacheInvalidateTags,
} from "./decorators/cache.decorators";
export type {
  CacheableOptions,
  CacheEvictOptions,
  CacheableHost,
} from "./decorators/cache.decorators";
export { TagCacheMetricsController } from "./tag-cache-metrics.controller";

export {
  TagCache,
  createTagCache,
  CacheConnectionError,
  CacheCompressionError,
  CacheSerializationError,
} from "tagcache";
export type { CacheConfig, CacheOptions, WarmTask } from "tagcache";
