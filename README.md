# Tagcache

Production Redis caching for Node.js — **wrap, tag, invalidate**.

Tagcache is a production layer on top of `redis@4` with compression, tag-based bulk invalidation, stampede protection, pipeline batching, cache warmup, and Prometheus metrics.

## Install

```bash
# Node.js or Express
npm install tagcache redis

# NestJS
npm install tagcache @tagcache/nestjs redis
```

Requires Node.js ≥ 18.

## Step-by-step guides (start here)

Full code walkthroughs from empty project to working app:

| Guide | Stack | What you build |
|---|---|---|
| **[Node.js guide](./docs/guides/nodejs.md)** | Vanilla `http` | API with cache, tags, metrics |
| **[Express guide](./docs/guides/express.md)** | Express.js | REST users API + invalidation |
| **[NestJS guide](./docs/guides/nestjs.md)** | NestJS | Module, `@Cacheable`, warmup, `/metrics` |

Also see [Getting started](./docs/01-getting-started.md) for Redis setup and prerequisites.

## Quick start (30 seconds)

```ts
import { createClient } from "redis";
import { createTagCache } from "tagcache";

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
import { TagCacheModule, InjectTagCache, Cacheable } from "@tagcache/nestjs";
import type { TagCache } from "tagcache";

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

See the [full NestJS guide](./docs/guides/nestjs.md) for complete project setup.

## When to use Tagcache

| Use Tagcache when… | Use something else when… |
|---|---|
| You cache in Redis in production | You need in-memory + Redis tiers → `cache-manager` |
| You need tag invalidation (`users`, `posts`) | You only cache HTTP responses → `@nestjs/cache-manager` |
| You want compression + metrics built in | You want a generic key-value store → raw `redis` client |

## Feature matrix

| Feature | Tagcache | cache-manager | Thin Redis wrapper |
|---|---|---|---|
| Compression | Built-in | No | Manual |
| Tag invalidation | Built-in | Store-dependent | Manual |
| Stampede protection | Built-in | Partial | Manual |
| Prometheus metrics | Built-in | No | Manual |
| NestJS module + decorators | `@tagcache/nestjs` | `@nestjs/cache-manager` | Manual |
| Multi-store (L1+L2) | No | Yes | No |

## Documentation

### Step-by-step guides

| Guide | Description |
|---|---|
| [Getting started](./docs/01-getting-started.md) | Prerequisites, Redis setup, doc map |
| [Node.js guide](./docs/guides/nodejs.md) | Complete vanilla Node tutorial |
| [Express guide](./docs/guides/express.md) | Complete Express tutorial |
| [NestJS guide](./docs/guides/nestjs.md) | Complete NestJS tutorial |

### Reference

| Doc | Topic |
|---|---|
| [Core API](./docs/02-core-api.md) | All methods |
| [Tags](./docs/04-tags.md) | Bulk invalidation |
| [Compression & keys](./docs/05-compression-keys.md) | Memory, hashing |
| [Metrics](./docs/06-metrics.md) | Prometheus |
| [Warmup](./docs/07-warmup.md) | Startup warming |
| [Configuration](./docs/08-configuration.md) | All options |
| [Migration](./docs/09-migration.md) | From cache-manager |
| [Troubleshooting](./docs/10-troubleshooting.md) | Common issues |
| [Benchmarks](./docs/11-benchmarks.md) | Performance |

## Packages

| npm package | Description |
|---|---|
| `tagcache` | Core library |
| `@tagcache/nestjs` | NestJS module, decorators, metrics controller |

## License

MIT
