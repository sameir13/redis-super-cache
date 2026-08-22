# Tags and invalidation

You will learn:

- How tags work in Redis
- How to invalidate related cache keys
- SaaS invalidation patterns

## What is a tag?

A **tag** groups cache keys for bulk deletion. Example: all keys tagged `users` are cleared when any user is updated.

## Register tags on write

```ts
await cache.set(`user:${id}`, user, { ttl: 3600, tags: ["users"] });

await cache.wrap(`user:${id}`, () => fetchUser(id), {
  ttl: 3600,
  tags: ["users"],
});
```

## Invalidate a tag

```ts
const deleted = await cache.invalidateTag("users");
```

This uses **2 Redis round trips** regardless of key count:

1. `SMEMBERS` to list keys
2. Pipeline `DEL` all keys + tag set

## Multiple tags

```ts
await cache.invalidateTags(["users", "posts", "comments"]);
```

## Multi-tenant tags

Use tenant-scoped tag names:

```ts
const tag = `client:${clientId}:users`;
await cache.set(key, value, { tags: [tag] });
await cache.invalidateTag(tag);
```

## Cleanup stale tags

When keys expire via TTL, tag sets may retain stale members. Run periodically:

```ts
await cache.cleanupTag("users");
```

## del() vs invalidateTag()

| Action | Effect |
|---|---|
| `del("user:1")` | Deletes one key + removes from tag sets |
| `invalidateTag("users")` | Deletes all keys under tag |
