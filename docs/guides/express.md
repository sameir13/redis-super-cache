# Express complete guide

You will learn:

- How to integrate Tagcache into an Express.js app
- How to structure cache logic in routes and services
- How to invalidate caches after writes

**Time:** ~20 minutes  
**Stack:** Express 4, Tagcache, Redis

---

## What we are building

A REST API for users:

| Method | Path | Description |
|---|---|---|
| `GET` | `/users/:id` | Get user (cached) |
| `PUT` | `/users/:id` | Update user + invalidate cache |
| `POST` | `/users/invalidate` | Invalidate all users tag |
| `GET` | `/metrics` | Prometheus scrape endpoint |

---

## Step 1 — Create the project

```bash
mkdir tagcache-express-demo
cd tagcache-express-demo
npm init -y
npm install express tagcache redis
npm pkg set type=module
```

---

## Step 2 — Environment

```bash
export REDIS_URL=redis://127.0.0.1:6379
export PORT=3000
```

Start Redis if needed:

```bash
docker run -d --name tagcache-redis -p 6379:6379 redis:7-alpine
```

---

## Step 3 — Project structure

```text
tagcache-express-demo/
  src/
    app.js           # Express app + routes
    cache.js         # TagCache singleton
    users.service.js # Business logic + caching
    users.data.js    # Fake in-memory DB
  package.json
```

---

## Step 4 — Fake database

Create `src/users.data.js`:

```js
const users = new Map([
  ["1", { id: "1", name: "Alice", email: "alice@example.com" }],
  ["2", { id: "2", name: "Bob", email: "bob@example.com" }],
]);

export async function findUserById(id) {
  await new Promise((r) => setTimeout(r, 150));
  console.log(`[db] findUserById(${id})`);
  return users.get(id) ?? null;
}

export async function updateUser(id, patch) {
  const user = users.get(id);
  if (!user) return null;
  const updated = { ...user, ...patch };
  users.set(id, updated);
  console.log(`[db] updateUser(${id})`);
  return updated;
}
```

---

## Step 5 — Cache module

Create `src/cache.js`:

```js
import { createClient } from "redis";
import { createTagCache, warmCache } from "tagcache";

let cache;
let client;

export async function setupCache() {
  client = createClient({
    url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  });

  client.on("error", (err) => console.error("[redis]", err.message));
  await client.connect();

  cache = createTagCache({
    client,
    keyPrefix: "tc",
    stampedeProtection: true,
    compressionThreshold: 1024,
    logger: false,
  });

  return cache;
}

export function getCache() {
  return cache;
}

export async function teardownCache() {
  if (client?.isOpen) await client.disconnect();
}
```

---

## Step 6 — Users service (cache-aside)

Create `src/users.service.js`:

```js
import { getCache } from "./cache.js";
import { findUserById, updateUser } from "./users.data.js";

const USERS_TAG = "users";

export async function getUser(id) {
  const cache = getCache();

  return cache.wrap(
    `user:${id}`,
    () => findUserById(id),
    { ttl: 3600, tags: [USERS_TAG] }
  );
}

export async function putUser(id, body) {
  const cache = getCache();
  const updated = await updateUser(id, body);

  if (updated) {
    // Clear this user's cache entry
    await cache.del(`user:${id}`);
    // Or invalidate entire users tag after bulk changes:
    // await cache.invalidateTag(USERS_TAG);
  }

  return updated;
}

export async function invalidateAllUsers() {
  const cache = getCache();
  return cache.invalidateTag(USERS_TAG);
}
```

**Why tags?** If you also cache `GET /users` (list), tagging both list and detail keys with `users` lets one `invalidateTag("users")` clear everything.

---

## Step 7 — Express app

Create `src/app.js`:

```js
import express from "express";
import { metricsEndpoint } from "tagcache";
import { setupCache, teardownCache } from "./cache.js";
import * as usersService from "./users.service.js";

const PORT = Number(process.env.PORT ?? 3000);

async function main() {
  await setupCache();

  const app = express();
  app.use(express.json());

  // ── Users ─────────────────────────────────────────────────────
  app.get("/users/:id", async (req, res) => {
    const user = await usersService.getUser(req.params.id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  });

  app.put("/users/:id", async (req, res) => {
    const user = await usersService.putUser(req.params.id, req.body);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  });

  app.post("/users/invalidate", async (_req, res) => {
    const deleted = await usersService.invalidateAllUsers();
    res.json({ deleted });
  });

  // ── Metrics ───────────────────────────────────────────────────
  app.get("/metrics", async (_req, res) => {
    res.set("Content-Type", "text/plain");
    res.send(await metricsEndpoint());
  });

  // ── Health ──────────────────────────────────────────────────
  app.get("/health", (_req, res) => res.json({ ok: true }));

  const server = app.listen(PORT, () => {
    console.log(`Express app on http://localhost:${PORT}`);
  });

  process.on("SIGINT", async () => {
    server.close();
    await teardownCache();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

---

## Step 8 — package.json scripts

```bash
npm pkg set scripts.start="node src/app.js"
```

---

## Step 9 — Run and test

```bash
npm start
```

```bash
# First call — slow (DB)
curl -s http://localhost:3000/users/1 | jq

# Second call — fast (cache hit)
curl -s http://localhost:3000/users/1 | jq

# Update user — clears cache for that key
curl -s -X PUT http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Updated"}' | jq

# Invalidate all users
curl -s -X POST http://localhost:3000/users/invalidate | jq

# Metrics
curl -s http://localhost:3000/metrics | grep redis_cache
```

---

## Step 10 — Optional: warmup on startup

In `src/cache.js`, after creating cache:

```js
import { findUserById } from "./users.data.js";

await warmCache(cache, [
  {
    key: "user:1",
    worker: () => findUserById("1"),
    ttl: 3600,
    tags: ["users"],
  },
]);
```

Keys that already exist in Redis are skipped (no redundant DB call on restart).

---

## Step 11 — Production tips

| Topic | Recommendation |
|---|---|
| Connection | One Redis client per process; reuse `TagCache` |
| Errors on read | `get()` returns `null` if Redis is down — design fallbacks |
| Errors on write | `set()` / `invalidateTag()` throw — handle in route |
| Multi-tenant | Use `namespace` in `createTagCache({ namespace: tenantId })` |
| Graceful shutdown | `await client.disconnect()` on SIGTERM |

---

## Express middleware pattern (optional)

Wrap cache in middleware for specific routes:

```js
function cacheWrap(key, ttl, tags) {
  return async (req, res, next) => {
    const cache = getCache();
    try {
      const data = await cache.wrap(key, () => next(), { ttl, tags });
      // For middleware, prefer service-layer wrap instead
      res.json(data);
    } catch (err) {
      next(err);
    }
  };
}
```

**Recommendation:** Keep caching in **services**, not middleware — easier to test and invalidate.

---

## Next steps

- [NestJS guide](./nestjs.md) — module + decorators
- [Node.js guide](./nodejs.md) — vanilla Node without Express
- [Tags reference](../04-tags.md)
