/**
 * Minimal Express + Tagcache example.
 * Run: REDIS_URL=redis://127.0.0.1:6379 npm start
 */
const express = require("express");
const { createClient } = require("redis");
const { createTagCache } = require("tagcache");

async function main() {
  const client = createClient({ url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379" });
  await client.connect();

  const cache = createTagCache({ client });

  const app = express();

  app.get("/users/:id", async (req, res) => {
    const id = req.params.id;
    const user = await cache.wrap(
      `user:${id}`,
      async () => ({ id, name: `User ${id}` }),
      { ttl: 300, tags: ["users"] }
    );
    res.json(user);
  });

  app.post("/users/invalidate", async (_req, res) => {
    const count = await cache.invalidateTag("users");
    res.json({ deleted: count });
  });

  app.listen(3000, () => console.log("http://localhost:3000"));
}

main().catch(console.error);
