# NestJS integration

> **For a full step-by-step tutorial**, see the [NestJS complete guide](./guides/nestjs.md).

You will learn:

- How to register `TagCacheModule`
- How to inject `TagCache`
- How to use `@Cacheable` and `@CacheEvict`

## Module setup

```ts
import { Module } from "@nestjs/common";
import { TagCacheModule } from "@tagcache/nestjs";

@Module({
  imports: [
    TagCacheModule.forRoot({
      isGlobal: true,
      redis: { url: process.env.REDIS_URL },
      keyPrefix: "tc",
      stampedeProtection: true,
      enableMetricsController: true,
      warmup: [
        { key: "config:global", worker: () => loadConfig(), ttl: 86400 },
      ],
    }),
  ],
})
export class AppModule {}
```

## Async configuration

```ts
TagCacheModule.forRootAsync({
  isGlobal: true,
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    redis: { url: config.get("REDIS_URL") },
  }),
});
```

## Inject TagCache

```ts
import { Injectable } from "@nestjs/common";
import { InjectTagCache } from "@tagcache/nestjs";
import type { TagCache } from "tagcache";

@Injectable()
export class UsersService {
  @InjectTagCache() tagCache!: TagCache;
}
```

## @Cacheable

```ts
@Cacheable({
  key: (id: number) => `user:${id}`,
  ttl: 3600,
  tags: ["users"],
  namespace: "client-42",
})
async findOne(id: number) {
  return this.prisma.user.findUnique({ where: { id } });
}
```

**Notes:** Your service class must expose `tagCache` (via `@InjectTagCache()`).

## @CacheEvict / @CacheInvalidateTags

```ts
@CacheEvict({ tags: ["users"] })
async updateUser(id: number, data: UpdateUserDto) {
  return this.prisma.user.update({ where: { id }, data });
}

@CacheInvalidateTags("users", "posts")
async rebuildSearchIndex() { /* ... */ }
```

## SaaS pattern (client_id scoping)

Pass tenant id into the key and tag names:

```ts
@Cacheable({
  key: (clientId: string, userId: number) => `${clientId}:user:${userId}`,
  ttl: 3600,
  tags: ["users"], // or `${clientId}:users` for per-tenant tags
})
async findUser(clientId: string, userId: number) { /* ... */ }
```

Or set `namespace` in `TagCacheModule.forRoot({ namespace: clientId })` per tenant deployment.

## Metrics endpoint

When `enableMetricsController: true`, scrape `GET /metrics`.

## Full walkthrough

See [NestJS complete guide](./guides/nestjs.md) for a full project from scratch with controller, service, repository, and curl tests.
