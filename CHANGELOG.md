# Changelog

## 2.0.1

- Fix npm README (full docs links, GitHub badges, repository metadata)
- Sync `packages/core/README.md` with root README on publish

## 2.0.0

### Breaking changes

- Rebranded internal API as **TagCache** while keeping npm name `redis-super-cache`
- `SuperCache` → `TagCache` (`SuperCache` kept as deprecated alias)
- `createCache()` → `createTagCache()` (deprecated alias kept)
- Default key prefix changed from `sc` to `tc`
- Tag Redis keys now namespaced: `{prefix}:tag:{name}` instead of `tag:{name}`
- Values stored in an internal envelope to support caching `null`

### Added

- Stampede protection (singleflight) on `wrap()`
- Tag cleanup on `del()` via meta keys
- `exists()`, `mget()`, `mset()`, `cleanupTag()`
- Pluggable `Serializer` interface
- Per-instance Prometheus `metricsRegistry`
- `RedisCacheClient` abstraction
- Warmup `force` option and true skip-if-exists
- `redis-super-cache-nestjs` with `TagCacheModule`, decorators, metrics controller
- Monorepo structure, CI, integration tests, full docs

### Fixed

- Jest/tsconfig test pipeline
- Documentation now matches fflate deflate (not LZ4)

## 1.0.0

- Initial release as `redis-super-cache`
