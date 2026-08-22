# Getting started with Redis Super Cache

You will learn:

- What `redis-super-cache` is and when to use it
- How to run Redis locally
- Which step-by-step guide to follow for your stack

## What is Redis Super Cache?

`redis-super-cache` is a **production Redis cache layer** for Node.js. You call `wrap()` to cache database results, tag keys for bulk invalidation, and get compression, metrics, and stampede protection without building them yourself.

**Tagline:** Production Redis caching — wrap, tag, invalidate.

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18 or higher |
| Redis | 6+ (7 recommended) |
| npm or yarn | any recent version |

## Step 1 — Start Redis locally

Using Docker (recommended):

```bash
docker run -d --name redis-super-cache-redis -p 6379:6379 redis:7-alpine
```

Verify Redis is running:

```bash
docker exec redis-super-cache-redis redis-cli ping
# Expected: PONG
```

Set the connection URL:

```bash
export REDIS_URL=redis://127.0.0.1:6379
```

## Step 2 — Pick your guide

Choose the guide that matches your project. Each guide is a **full walkthrough** from empty folder to working app with copy-paste code.

| Guide | Stack | What you build |
|---|---|---|
| [Node.js guide](./guides/nodejs.md) | Vanilla Node.js (`http` module) | Small API with cache-aside, tags, metrics |
| [Express guide](./guides/express.md) | Express.js | REST API with users CRUD + cache invalidation |
| [NestJS guide](./guides/nestjs.md) | NestJS + `redis-super-cache-nestjs` | Module, decorators, warmup, `/metrics` |

## Step 3 — Install packages

**Node.js or Express:**

```bash
npm install redis-super-cache redis
```

**NestJS:**

```bash
npm install redis-super-cache redis-super-cache-nestjs redis
```

## Core concept (30 seconds)

```ts
// 1. Miss → run fn, store result, return it
// 2. Hit  → return cached value, fn never runs
const user = await cache.wrap(
  "user:42",
  () => database.findUser(42),
  { ttl: 3600, tags: ["users"] }
);

// After an update, clear all user caches in one call
await cache.invalidateTag("users");
```

## Documentation map

### Step-by-step guides (start here)

- [Node.js complete guide](./guides/nodejs.md)
- [Express complete guide](./guides/express.md)
- [NestJS complete guide](./guides/nestjs.md)

### Reference and advanced topics

| Doc | Topic |
|---|---|
| [Core API](./02-core-api.md) | Every method and option |
| [Tags](./04-tags.md) | Invalidation patterns |
| [Compression & keys](./05-compression-keys.md) | Memory and hashing |
| [Metrics](./06-metrics.md) | Prometheus |
| [Warmup](./07-warmup.md) | Startup warming |
| [Configuration](./08-configuration.md) | All config options |
| [Migration](./09-migration.md) | From cache-manager |
| [Troubleshooting](./10-troubleshooting.md) | Common issues |
| [Benchmarks](./11-benchmarks.md) | Performance notes |
| [API reference](./api/README.md) | TypeDoc |

## When to use Redis Super Cache vs alternatives

| Use redis-super-cache | Use something else |
|---|---|
| Redis production caching with tags | Tiered memory + Redis → `cache-manager` |
| Service-level caching in NestJS | HTTP-only caching → `@nestjs/cache-manager` |
| Compression + metrics built in | Raw key-value only → `redis` client |

## Next step

Open [Node.js](./guides/nodejs.md), [Express](./guides/express.md), or [NestJS](./guides/nestjs.md) and follow from Step 1.
