# Redis Super Cache

[![npm version](https://img.shields.io/npm/v/redis-super-cache)](https://www.npmjs.com/package/redis-super-cache)
[![license](https://img.shields.io/npm/l/redis-super-cache)](https://github.com/sameir13/redis-super-cache/blob/main/LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-sameir13%2Fredis--super--cache-blue)](https://github.com/sameir13/redis-super-cache)

**Repository:** [github.com/sameir13/redis-super-cache](https://github.com/sameir13/redis-super-cache)

Production Redis caching for Node.js — **wrap, tag, invalidate**.

`redis-super-cache` is a production layer on top of `redis@4` with compression, tag-based bulk invalidation, stampede protection, pipeline batching, cache warmup, and Prometheus metrics.

## Install

```bash
# Node.js or Express
npm install redis-super-cache redis

# NestJS
npm install redis-super-cache redis-super-cache-nestjs redis
```

Requires Node.js ≥ 18.

## Step-by-step guides (start here)

Full code walkthroughs from empty project to working app:

| Guide | Stack | What you build |
|---|---|---|
| **[Node.js guide](https://github.com/sameir13/redis-super-cache/blob/main/docs/guides/nodejs.md)** | Vanilla `http` | API with cache, tags, metrics |
| **[Express guide](https://github.com/sameir13/redis-super-cache/blob/main/docs/guides/express.md)** | Express.js | REST users API + invalidation |
| **[NestJS guide](https://github.com/sameir13/redis-super-cache/blob/main/docs/guides/nestjs.md)** | NestJS | Module, `@Cacheable`, warmup, `/metrics` |

Also see [Getting started](https://github.com/sameir13/redis-super-cache/blob/main/docs/01-getting-started.md) for Redis setup and prerequisites.

## Quick start (30 seconds)

```ts
import { createClient } from "redis";
import { createTagCache } from "redis-super-cache";

const client = createClient({ url: process.env.REDIS_URL });
await client.connect();

const cache = createTagCache({ client: client as never });

const user = await cache.wrap(
  "user:1",
  () => db.user.findUnique({ where: { id: 1 } }),
  { ttl: 3600, tags: ["users"] }
);

await cache.invalidateTag("users");
```

## NestJS quick start

```ts
import { Module, Injectable } from "@nestjs/common";
import { TagCacheModule, InjectTagCache, Cacheable } from "redis-super-cache-nestjs";
import type { TagCache } from "redis-super-cache";

@Module({
  imports: [
    TagCacheModule.forRoot({
      isGlobal: true,
      redis: { url: process.env.REDIS_URL },
      enableMetricsController: true,
    }),
  ],
})
export class AppModule {}

@Injectable()
export class UsersService {
  @InjectTagCache() tagCache!: TagCache;

  @Cacheable({ key: (id: number) => `user:${id}`, ttl: 3600, tags: ["users"] })
  async findOne(id: number) {
    return this.db.user.findUnique({ where: { id } });
  }
}
```

See the [full NestJS guide](https://github.com/sameir13/redis-super-cache/blob/main/docs/guides/nestjs.md) for complete project setup.

## When to use Redis Super Cache

| Use redis-super-cache when… | Use something else when… |
|---|---|
| You cache in Redis in production | You need in-memory + Redis tiers → `cache-manager` |
| You need tag invalidation (`users`, `posts`) | You only cache HTTP responses → `@nestjs/cache-manager` |
| You want compression + metrics built in | You want a generic key-value store → raw `redis` client |

## Feature matrix

| Feature | redis-super-cache | cache-manager | Thin Redis wrapper |
|---|---|---|---|
| Compression | Built-in | No | Manual |
| Tag invalidation | Built-in | Store-dependent | Manual |
| Stampede protection | Built-in | Partial | Manual |
| Prometheus metrics | Built-in | No | Manual |
| NestJS module + decorators | `redis-super-cache-nestjs` | `@nestjs/cache-manager` | Manual |
| Multi-store (L1+L2) | No | Yes | No |

## Documentation

### Step-by-step guides

| Guide | Description |
|---|---|
| [Getting started](https://github.com/sameir13/redis-super-cache/blob/main/docs/01-getting-started.md) | Prerequisites, Redis setup, doc map |
| [Node.js guide](https://github.com/sameir13/redis-super-cache/blob/main/docs/guides/nodejs.md) | Complete vanilla Node tutorial |
| [Express guide](https://github.com/sameir13/redis-super-cache/blob/main/docs/guides/express.md) | Complete Express tutorial |
| [NestJS guide](https://github.com/sameir13/redis-super-cache/blob/main/docs/guides/nestjs.md) | Complete NestJS tutorial |

### Reference

| Doc | Topic |
|---|---|
| [Core API](https://github.com/sameir13/redis-super-cache/blob/main/docs/02-core-api.md) | All methods |
| [Tags](https://github.com/sameir13/redis-super-cache/blob/main/docs/04-tags.md) | Bulk invalidation |
| [Compression & keys](https://github.com/sameir13/redis-super-cache/blob/main/docs/05-compression-keys.md) | Memory, hashing |
| [Metrics](https://github.com/sameir13/redis-super-cache/blob/main/docs/06-metrics.md) | Prometheus |
| [Warmup](https://github.com/sameir13/redis-super-cache/blob/main/docs/07-warmup.md) | Startup warming |
| [Configuration](https://github.com/sameir13/redis-super-cache/blob/main/docs/08-configuration.md) | All options |
| [Migration](https://github.com/sameir13/redis-super-cache/blob/main/docs/09-migration.md) | Upgrading from v1 |
| [Troubleshooting](https://github.com/sameir13/redis-super-cache/blob/main/docs/10-troubleshooting.md) | Common issues |
| [Benchmarks](https://github.com/sameir13/redis-super-cache/blob/main/docs/11-benchmarks.md) | Performance |

## Packages

| npm package | Description |
|---|---|
| `redis-super-cache` | Core library |
| `redis-super-cache-nestjs` | NestJS module, decorators, metrics controller |

## License

MIT — see [LICENSE](https://github.com/sameir13/redis-super-cache/blob/main/LICENSE).
