# Node.js complete guide

You will learn:

- How to set up a vanilla Node.js project with Tagcache
- How to cache API responses with `wrap()`
- How to invalidate by tag and expose Prometheus metrics

**Time:** ~15 minutes  
**Stack:** Node.js 18+, `http` module (no Express), Tagcache, Redis

---

## What we are building

A small HTTP API with two endpoints:

| Endpoint | Behavior |
|---|---|
| `GET /products` | Returns product list (cached 5 min, tag `products`) |
| `POST /invalidate/products` | Clears all product caches |
| `GET /metrics` | Prometheus metrics |

---

## Step 1 — Create the project

```bash
mkdir tagcache-node-demo
cd tagcache-node-demo
npm init -y
npm install tagcache redis
```

Add `"type": "module"` for ESM imports (or use CommonJS — examples below use ESM):

```bash
npm pkg set type=module
```

Create folders:

```bash
mkdir src
```

---

## Step 2 — Environment variables

Create `.env` (optional) or export in your shell:

```bash
export REDIS_URL=redis://127.0.0.1:6379
export PORT=3000
```

Add `.env` to `.gitignore`:

```gitignore
node_modules/
.env
```

---

## Step 3 — Fake database (stand-in for Prisma/DB)

Create `src/db.js` — simulates slow database queries:

```js
/** Simulates a slow DB read (200ms) */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const PRODUCTS = [
  { id: 1, name: "Keyboard", price: 79 },
  { id: 2, name: "Monitor", price: 299 },
  { id: 3, name: "Webcam", price: 49 },
];

export async function fetchProductsFromDb() {
  await sleep(200);
  console.log("[db] SELECT * FROM products");
  return PRODUCTS;
}
```

---

## Step 4 — Redis + Tagcache setup

Create `src/cache.js`:

```js
import { createClient } from "redis";
import { createTagCache } from "tagcache";

let cache;
let redisClient;

/**
 * Connect Redis and create a shared TagCache instance.
 * Call once at app startup.
 */
export async function initCache() {
  redisClient = createClient({
    url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  });

  redisClient.on("error", (err) => {
    console.error("[redis] error:", err.message);
  });

  await redisClient.connect();
  console.log("[redis] connected");

  cache = createTagCache({
    client: redisClient,
    keyPrefix: "tc",
    stampedeProtection: true,
    logger: console,
  });

  return cache;
}

export function getCache() {
  if (!cache) {
    throw new Error("Cache not initialized. Call initCache() first.");
  }
  return cache;
}

export async function closeCache() {
  if (redisClient?.isOpen) {
    await redisClient.disconnect();
    console.log("[redis] disconnected");
  }
}
```

**Notes:**

- `stampedeProtection: true` — concurrent requests for the same key only hit the DB once.
- `client` must be connected before passing to `createTagCache`.

---

## Step 5 — HTTP server with caching

Create `src/server.js`:

```js
import http from "node:http";
import { metricsEndpoint } from "tagcache";
import { fetchProductsFromDb } from "./db.js";
import { getCache, initCache, closeCache } from "./cache.js";

const PORT = Number(process.env.PORT ?? 3000);

async function handleRequest(req, res) {
  const url = req.url ?? "/";
  const cache = getCache();

  // ── GET /products ─────────────────────────────────────────────
  if (req.method === "GET" && url === "/products") {
    const products = await cache.wrap(
      "products:all",
      () => fetchProductsFromDb(),
      { ttl: 300, tags: ["products"] }
    );

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ products, cached: true }));
    return;
  }

  // ── POST /invalidate/products ────────────────────────────────
  if (req.method === "POST" && url === "/invalidate/products") {
    const deleted = await cache.invalidateTag("products");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ deleted, message: "products tag invalidated" }));
    return;
  }

  // ── GET /metrics ──────────────────────────────────────────────
  if (req.method === "GET" && url === "/metrics") {
    const body = await metricsEndpoint();
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(body);
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
}

async function main() {
  await initCache();

  const server = http.createServer(handleRequest);

  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log("Try: curl http://localhost:3000/products");
  });

  process.on("SIGINT", async () => {
    await closeCache();
    server.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

---

## Step 6 — Run the app

```bash
node src/server.js
```

---

## Step 7 — Test with curl

**First request (cache miss — slow, ~200ms DB):**

```bash
curl -s http://localhost:3000/products | jq
```

You should see `[db] SELECT * FROM products` in the server log.

**Second request (cache hit — fast, no DB log):**

```bash
curl -s http://localhost:3000/products | jq
```

**Invalidate all product caches:**

```bash
curl -s -X POST http://localhost:3000/invalidate/products | jq
```

**Next GET hits DB again:**

```bash
curl -s http://localhost:3000/products | jq
```

**Prometheus metrics:**

```bash
curl -s http://localhost:3000/metrics | head -20
```

Look for `redis_cache_hits_total` and `redis_cache_misses_total`.

---

## Step 8 — Common patterns

### Cache a single record by ID

```js
const product = await cache.wrap(
  `product:${id}`,
  () => db.findProduct(id),
  { ttl: 600, tags: ["products"] }
);
```

### Manual get / set (without wrap)

```js
const cached = await cache.get("config");
if (cached === null) {
  const config = await loadConfig();
  await cache.set("config", config, { ttl: 86400 });
}
```

### Batch read

```js
const map = await cache.mget(["product:1", "product:2"]);
const p1 = map.get("product:1");
```

### Warm cache on startup

```js
import { warmCache } from "tagcache";

await warmCache(cache, [
  {
    key: "products:all",
    worker: fetchProductsFromDb,
    ttl: 300,
    tags: ["products"],
  },
]);
```

---

## Project structure (final)

```text
tagcache-node-demo/
  package.json
  src/
    db.js       # fake database
    cache.js    # Redis + TagCache init
    server.js   # HTTP server
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `ECONNREFUSED` | Start Redis: `docker run -p 6379:6379 redis:7-alpine` |
| Every request hits DB | Check TTL expired or tag was invalidated |
| `Cache not initialized` | Call `await initCache()` before `getCache()` |

---

## Next steps

- [Express guide](./express.md) — REST API with Express
- [NestJS guide](./nestjs.md) — decorators and module
- [Tags reference](../04-tags.md) — invalidation deep dive
