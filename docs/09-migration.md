# Migration guide

You will learn:

- How to migrate from `redis-super-cache`
- How to migrate from `cache-manager`
- How to migrate from hand-rolled Redis

## From redis-super-cache 1.x → 2.0

```bash
npm install redis-super-cache@latest
```

| Old | New |
|---|---|
| `createCache` | `createTagCache` |
| `SuperCache` | `TagCache` |
| prefix `sc` | prefix `tc` |
| tags at `tag:name` | tags at `{prefix}:tag:name` |

Invalidate old tags once after deploy, or accept orphaned tag sets.

## From cache-manager

`redis-super-cache` is **Redis-only** and not a drop-in replacement.

Replace:

```ts
// cache-manager
await cacheManager.get(key);
await cacheManager.set(key, value, ttl);
```

With:

```ts
await cache.wrap(key, () => fetch(), { ttl, tags });
```

Use cache-manager if you need memory + Redis tiered caching.

## From hand-rolled Redis

`redis-super-cache` replaces manual:

- Compression → built-in
- Metrics → built-in
- Tag invalidation → `invalidateTag()`
- Stampede protection → `wrap()` with `stampedeProtection: true`
