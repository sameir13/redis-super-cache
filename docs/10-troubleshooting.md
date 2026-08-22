# Troubleshooting

You will learn:

- Common errors and fixes
- Redis outage behavior
- Tag orphan issues

## get() always returns null

**Causes:**

- Redis not connected
- Wrong `keyPrefix` / `namespace` after config change
- Key expired (TTL)

**Fix:** Check Redis URL, verify `exists(key)`, inspect metrics for errors.

## Redis is down — will my app crash?

**No** for reads. `get()` catches errors and returns `null`.

Writes (`set`, `del`, `invalidateTag`) throw `CacheConnectionError`.

## Cannot cache null

In v2, `null` is supported via internal envelope. Use `set(key, null)` or `wrap` returning `null`.

## Tag set growing over time

Keys expired by TTL may leave stale entries in tag sets.

**Fix:** Run `cleanupTag("users")` on a schedule.

## Stampede still hitting DB

Ensure `stampedeProtection: true` (default) and all callers use `wrap()`, not manual get/set.

## NestJS @Cacheable not working

Ensure service has:

```ts
@InjectTagCache() tagCache!: TagCache;
```

The property must be named `tagCache`.

## TypeScript client typing

Pass client as `client as never` if `redis@4` types lack `getBuffer`.
