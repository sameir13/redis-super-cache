import { createClient } from "redis";
import { createTagCache } from "./index";

const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

describe("TagCache integration", () => {
  let client: ReturnType<typeof createClient>;
  let cache: ReturnType<typeof createTagCache>;

  beforeAll(async () => {
    client = createClient({
      url: REDIS_URL,
      socket: { connectTimeout: 2000, reconnectStrategy: false },
    });
    client.on("error", () => undefined);
    try {
      await client.connect();
    } catch {
      // skip if redis unavailable
    }
  }, 10000);

  afterAll(async () => {
    if (client?.isOpen) await client.disconnect();
  });

  beforeEach(async () => {
    if (!client?.isOpen) {
      return;
    }
    cache = createTagCache({
      client: client as never,
      keyPrefix: "itest",
      logger: false,
    });
    await client.flushDb();
  });

  const runIfRedis = (): boolean => client?.isOpen === true;

  it("stores and retrieves values", async () => {
    if (!runIfRedis()) return;
    await cache.set("user:1", { name: "Alice" }, { ttl: 60, tags: ["users"] });
    expect(await cache.get("user:1")).toEqual({ name: "Alice" });
    const deleted = await cache.invalidateTag("users");
    expect(deleted).toBeGreaterThanOrEqual(1);
  });

  it("supports stampede protection under concurrency", async () => {
    if (!runIfRedis()) return;
    let calls = 0;
    const fn = async () => {
      calls++;
      return { n: calls };
    };
    await Promise.all([
      cache.wrap("concurrent", fn, { ttl: 30 }),
      cache.wrap("concurrent", fn, { ttl: 30 }),
    ]);
    expect(calls).toBe(1);
  });
});
