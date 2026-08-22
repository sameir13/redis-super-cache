# Warmup

You will learn:

- Why warm the cache at startup
- How `warmCache()` works
- Skip vs force behavior

## Why warmup?

Cold starts cause DB spikes when traffic hits before caches are populated. Warmup pre-loads critical keys in parallel.

## Basic usage

```ts
import { warmCache } from "redis-super-cache";

await warmCache(cache, [
  { key: "home:featured", worker: getFeatured, ttl: 3600 },
  { key: "config:global", worker: getConfig, ttl: 86400 },
]);
```

## Skip if exists

By default, if a key already exists in Redis, the worker is **skipped** (no redundant DB call on restart).

## Force refresh

```ts
{ key: "config", worker: loadConfig, ttl: 3600, force: true }
```

## Fault isolation

One failing task does not abort others. Check results:

```ts
const results = await warmCache(cache, tasks);
for (const r of results) {
  if (!r.success) console.error(r.key, r.error);
}
```

## NestJS

Pass `warmup` array to `TagCacheModule.forRoot()` — runs automatically on boot.
