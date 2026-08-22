# Tagcache API Reference

Generated with [TypeDoc](https://typedoc.org/).

```bash
npx typedoc --options typedoc.json
```

Output is written to `docs/api/`.

## Core exports

- `TagCache`, `createTagCache`
- `warmCache`, `metricsEndpoint`
- `CacheConnectionError`, `CacheCompressionError`, `CacheSerializationError`

## NestJS exports (`@tagcache/nestjs`)

- `TagCacheModule`
- `InjectTagCache`
- `@Cacheable`, `@CacheEvict`, `@CacheInvalidateTags`
- `TagCacheMetricsController`

See [Core API](./02-core-api.md) and [NestJS](./03-nestjs.md) for usage examples.
