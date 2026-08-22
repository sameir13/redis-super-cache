# Core API

You will learn:

- Every `TagCache` method
- Options for TTL and tags
- Batch and invalidation helpers

## createTagCache(config)

```ts
const cache = createTagCache({
  client,                 // required — connected Redis client
  keyPrefix: "tc",        // default "tc"
  namespace: "tenant-a",  // optional multi-tenant prefix
  compressionThreshold: 1024,
  stampedeProtection: true,
  serializer: jsonSerializer,
  logger: console,        // or false
});
```

## get(key)

```ts
const user = await cache.get<User>("user:1");
// User | null — null on miss or Redis error
```

## set(key, value, options?)

```ts
await cache.set("user:1", { name: "Alice" }, {
  ttl: 3600,
  tags: ["users"],
});
```

## del(key)

```ts
await cache.del("user:1");
// Also removes key from tag sets
```

## wrap(key, fn, options?)

Primary cache-aside helper with stampede protection.

```ts
const posts = await cache.wrap(
  "posts:featured",
  () => db.posts.findMany(),
  { ttl: 600, tags: ["posts"] }
);
```

## exists(key)

```ts
if (await cache.exists("config")) { /* skip DB */ }
```

## mget / mset

```ts
const map = await cache.mget<number>(["a", "b"]);
await cache.mset([
  { key: "a", value: 1, options: { ttl: 60 } },
  { key: "b", value: 2 },
]);
```

## invalidateTag / invalidateTags

```ts
await cache.invalidateTag("users");
await cache.invalidateTags(["users", "posts"]);
```

## cleanupTag(tag)

Removes stale members from a tag set when keys expired via TTL.

```ts
await cache.cleanupTag("users");
```

## warmCache(cache, tasks)

```ts
import { warmCache } from "tagcache";

await warmCache(cache, [
  { key: "config", worker: loadConfig, ttl: 86400, force: false },
]);
```

## metricsEndpoint()

```ts
import { metricsEndpoint } from "tagcache";
const text = await metricsEndpoint();
```
