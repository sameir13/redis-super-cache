# redis-super-cache

Production-grade Redis caching for Node.js with fflate compression, xxHash key hashing, tag-based bulk invalidation, pipeline batching, cache warmup, and Prometheus metrics.

[![npm version](https://img.shields.io/npm/v/redis-super-cache)](https://www.npmjs.com/package/redis-super-cache)
[![license](https://img.shields.io/npm/l/redis-super-cache)](./LICENSE)
[![node](https://img.shields.io/node/v/redis-super-cache)](https://nodejs.org)

---

## Why redis-super-cache?

Most Redis cache wrappers are thin clients. This one is a production layer:

- **Compression** — values over 1KB are automatically compressed with fflate, reducing Redis memory by 60–80% on JSON payloads
- **Key hashing** — all keys are hashed with xxHash64 so arbitrarily long keys become short, consistent Redis keys
- **Pipeline batching** — set + tag registration happen in a single Redis round trip, not 3–4
- **Tag invalidation** — group related keys under tags and bulk-delete them in one call
- **Cache warmup** — pre-populate the cache at startup before traffic hits, with per-task fault isolation
- **Prometheus metrics** — hits, misses, errors, latency, and tag sizes exported out of the box
- **Safe by default** — `get()` never throws; a broken Redis connection degrades gracefully to null

---

## Install
```bash
npm install redis-super-cache redis
```

Requires Node.js ≥ 18 and redis ≥ 4.0.0

---

## Quick start
```ts
import { createClient } from "redis";
import { createCache } from "redis-super-cache";

const client = createClient({ url: process.env.REDIS_URL });
await client.connect();

export const cache = createCache({ client: client as any });

const user = await cache.wrap(
  "user:1",
  () => db.user.findUnique({ where: { id: 1 } }),
  { ttl: 3600, tags: ["users"] }
);

await cache.set("config", { theme: "dark" }, { ttl: 86400 });
const config = await cache.get<{ theme: string }>("config");
await cache.del("config");

await cache.invalidateTag("users");
await cache.invalidateTags(["users", "posts"]);
```

---

## Configuration

### createCache(config): SuperCache

| Option | Type | Default | Description |
|---|---|---|---|
| `client` | `RedisClientType` | required | A connected redis@4 client. You manage the connection lifecycle. |
| `keyPrefix` | `string` | `"sc"` | Namespace prefix added to every hashed key e.g. `sc:3f8a2c1d` |
| `compressionThreshold` | `number` | `1024` | Byte size a value must reach before fflate compression is applied |
| `logger` | `Logger \| false` | `console` | Pass `false` to silence all internal warnings and errors |

---

## API Reference

### cache.get\<T\>(key)

Retrieves and deserializes a cached value. Returns `null` on miss or on any internal error. Never throws — errors are logged and counted in Prometheus instead.
```ts
const user = await cache.get<User>("user:1");
// returns User | null
```

---

### cache.set\<T\>(key, value, options?)

Serializes, compresses if above threshold, and stores a value. Tags and TTL are optional. The set command and all tag registrations are batched into a single Redis pipeline — no extra round trips.
```ts
await cache.set("user:1", { id: 1, name: "Alice" }, {
  ttl: 3600,
  tags: ["users"]
});
```

| Option | Type | Description |
|---|---|---|
| `ttl` | `number` | Expiry in seconds. Omit for no expiry. |
| `tags` | `string[]` | Tags to register this key under for bulk invalidation |

Throws `CacheSerializationError` if JSON.stringify fails and `CacheConnectionError` if the Redis write fails.

---

### cache.del(key)

Deletes a single key by its original pre-hash name.
```ts
await cache.del("user:1");
```

Throws `CacheConnectionError` if the Redis DEL command fails.

---

### cache.wrap\<T\>(key, fn, options?)

The primary cache-aside helper. Returns the cached value if it exists, otherwise calls fn, stores the result, and returns it. This is the pattern you should reach for in most cases.
```ts
const posts = await cache.wrap(
  "posts:featured",
  async () => db.posts.findMany({ where: { featured: true } }),
  { ttl: 600, tags: ["posts"] }
);
```

- **Hit** — returns cached value, fn is never called
- **Miss** — calls fn, stores the result, returns it
- **fn throws** — the error propagates naturally, nothing is cached

---

### cache.invalidateTag(tag)

Deletes all keys registered under a tag in a single pipeline call. Returns the number of keys deleted.
```ts
const deleted = await cache.invalidateTag("users");
console.log(`Cleared ${deleted} cached user keys`);
```

---

### cache.invalidateTags(tags[])

Invalidates multiple tags in parallel. Returns total keys deleted across all tags.
```ts
await cache.invalidateTags(["users", "posts", "comments"]);
```

---

## Cache warmup

Pre-populate the cache at server startup to avoid cold-start database spikes. All tasks run in parallel via Promise.all. Each task is individually wrapped in try/catch so one failing worker never aborts the rest.
```ts
import { warmCache } from "redis-super-cache";

const results = await warmCache(cache, [
  { key: "home:featured", worker: getFeaturedItems, ttl: 3600 },
  { key: "config:global", worker: getGlobalConfig,  ttl: 86400 },
  { key: "nav:menu",      worker: getNavMenu,        ttl: 3600 },
]);

for (const r of results) {
  if (!r.success) {
    console.error(`Warmup failed for ${r.key}:`, r.error);
  }
}
```

| Field | Type | Description |
|---|---|---|
| `key` | `string` | Cache key to warm |
| `worker` | `() => Promise<T>` | Async function that fetches the data |
| `ttl` | `number` | Optional TTL in seconds |
| `tags` | `string[]` | Optional tags to register the key under |

If a key already exists in Redis the worker is skipped entirely — no redundant DB calls on server restart.

---

## Prometheus metrics

Five metrics are recorded automatically on every cache operation. Expose them via any HTTP server for Prometheus to scrape.
```ts
import express from "express";
import { metricsEndpoint } from "redis-super-cache";

const app = express();

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", "text/plain");
  res.send(await metricsEndpoint());
});
```

| Metric | Type | Description |
|---|---|---|
| `redis_cache_hits_total` | Counter | get() returned a value |
| `redis_cache_misses_total` | Counter | get() returned null |
| `redis_cache_errors_total` | Counter | Any operation threw, labeled by operation and error_type |
| `redis_cache_latency_ms` | Histogram | Operation duration in ms, labeled by operation |
| `redis_cache_tag_size` | Gauge | Number of keys currently registered under each tag |

---

## Error handling

All three error classes extend `Error` and carry a `cause` property pointing to the original underlying error.

| Class | Thrown when |
|---|---|
| `CacheConnectionError` | Redis command fails — network down, timeout, connection refused |
| `CacheCompressionError` | fflate compress or decompress fails, or stored header is corrupt |
| `CacheSerializationError` | JSON.stringify fails — circular reference, BigInt, undefined values |
```ts
import { CacheConnectionError, CacheSerializationError } from "redis-super-cache";

try {
  await cache.set("key", value);
} catch (err) {
  if (err instanceof CacheConnectionError) {
    console.error("Redis is down:", err.cause);
  }
  if (err instanceof CacheSerializationError) {
    console.error("Value could not be serialized:", err.cause);
  }
}
```

`get()` catches all errors internally and returns `null` so a Redis outage never crashes a read path. `set()`, `del()`, and `invalidateTag()` throw explicitly so you can decide how to handle write failures in your own application logic.

---

## NestJS integration

Register a global cache module once and inject it into any service across the entire application.
```ts
// cache.module.ts
import { Module, Global } from "@nestjs/common";
import { createClient } from "redis";
import { createCache } from "redis-super-cache";

@Global()
@Module({
  providers: [
    {
      provide: "REDIS_CACHE",
      useFactory: async () => {
        const client = createClient({ url: process.env.REDIS_URL });
        await client.connect();
        return createCache({ client: client as any });
      },
    },
  ],
  exports: ["REDIS_CACHE"],
})
export class CacheModule {}
```
```ts
// app.module.ts
import { Module } from "@nestjs/common";
import { CacheModule } from "./cache.module";

@Module({
  imports: [CacheModule],
})
export class AppModule {}
```
```ts
// users.service.ts
import { Injectable, Inject } from "@nestjs/common";
import { SuperCache } from "redis-super-cache";

@Injectable()
export class UsersService {
  constructor(@Inject("REDIS_CACHE") private cache: SuperCache) {}

  async findOne(id: number) {
    return this.cache.wrap(
      `user:${id}`,
      () => this.db.users.findUnique({ where: { id } }),
      { ttl: 3600, tags: ["users"] }
    );
  }

  async updateUser(id: number, data: any) {
    await this.db.users.update({ where: { id }, data });
    await this.cache.invalidateTag("users");
  }
}
```

---

## How compression works

Values are serialized to JSON then checked against the threshold (default 1024 bytes). If below the threshold the value is stored as-is with a 9-byte plain header. If above the threshold it is compressed with fflate deflate at level 6 and stored with a 9-byte compressed header. The header encodes both the original and compressed sizes so decompression always allocates exactly the right buffer — no size guessing, no crashes on large payloads. Typical compression ratio on JSON is 60–80%.

---

## How key hashing works

Every key you pass in is run through xxHash64 and prefixed with the keyPrefix option:
```
"user:profile:1234:settings:theme" → "sc:3f8a2c1d9b047e21"
```

Keys are always 16 hex characters regardless of input length. The same input always produces the same hash. Collision probability is negligible given the 2^64 hash space. For multi-tenant applications set a unique keyPrefix per tenant so keys from different tenants never collide.

---

## How pipeline batching works

Without pipelines, a set() call with 2 tags fires 3 separate Redis round trips:
```
SET  sc:abc123 <data>    → trip 1
SADD tag:users sc:abc123 → trip 2
SADD tag:posts sc:abc123 → trip 3
```

With pipelines all commands are batched into a single network call:
```
MULTI
  SET  sc:abc123 <data>
  SADD tag:users sc:abc123
  SADD tag:posts sc:abc123
EXEC                     → 1 trip total
```

On a Redis instance with 50ms network latency this alone saves ~100ms per write with 2 tags.

---

## How tag invalidation works

Tags are stored as Redis Sets. Every time you call set() with a tag, the hashed key is added to that Set:
```
tag:users → { "sc:abc123", "sc:def456", "sc:ghi789" }
```

When you call invalidateTag("users"):

1. SMEMBERS tag:users fetches all keys in the Set in one trip
2. A pipeline fires DEL for every key plus DEL tag:users in a second trip
3. Returns the total count of deleted keys

This means invalidating 10,000 user keys takes exactly 2 Redis round trips regardless of how many keys are in the tag.

---

## License

MIT