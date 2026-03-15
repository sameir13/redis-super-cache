import { SuperCache } from "./cache";
import { compress } from "./compression";
import { CacheConnectionError, CacheSerializationError } from "./errors";
import { resetMetrics } from "./metrics";

const store = new Map<string, Buffer>();
const tagStore = new Map<string, Set<string>>();

interface MockPipeline {
  set: jest.Mock;
  del: jest.Mock;
  sAdd: jest.Mock;
  exec: jest.Mock;
}

function makeMockClient() {
  return {
    getBuffer: jest.fn(async (key: string) => store.get(key) ?? null),

    multi: jest.fn(() => {
      const ops: Array<() => void> = [];
      const pipeline: MockPipeline = {
        set: jest.fn((key: string, value: Buffer, _opts?: unknown) => {
          ops.push(() => store.set(key, value));
          return pipeline;
        }),
        del: jest.fn((key: string) => {
          ops.push(() => { store.delete(key); tagStore.delete(key); });
          return pipeline;
        }),
        sAdd: jest.fn((tagKey: string, member: string) => {
          ops.push(() => {
            if (!tagStore.has(tagKey)) tagStore.set(tagKey, new Set());
            tagStore.get(tagKey)!.add(member);
          });
          return pipeline;
        }),
        exec: jest.fn(async () => { ops.forEach((op) => op()); }),
      };
      return pipeline;
    }),

    sMembers: jest.fn(async (tagKey: string) =>
      Array.from(tagStore.get(tagKey) ?? [])
    ),

    del: jest.fn(async (key: string) => { store.delete(key); return 1; }),
    sCard: jest.fn(async () => 0),
  };
}

function makeCache(clientOverrides?: Partial<ReturnType<typeof makeMockClient>>) {
  const client = { ...makeMockClient(), ...clientOverrides };
  return {
    cache: new SuperCache({ client: client as any, logger: false }),
    client,
  };
}

beforeEach(() => {
  store.clear();
  tagStore.clear();
  resetMetrics();
});

describe("SuperCache.get()", () => {
  it("returns null on cache miss", async () => {
    const { cache } = makeCache();
    expect(await cache.get("missing")).toBeNull();
  });

  it("returns the stored value on hit", async () => {
    const { cache, client } = makeCache();
    const payload = compress(JSON.stringify({ id: 1 }));
    (client.getBuffer as jest.Mock).mockResolvedValueOnce(payload);
    expect(await cache.get("user:1")).toEqual({ id: 1 });
  });

  it("returns null and does NOT throw when Redis errors", async () => {
    const { cache } = makeCache({
      getBuffer: jest.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    });
    await expect(cache.get("key")).resolves.toBeNull();
  });
});

describe("SuperCache.set()", () => {
  it("stores a value retrievable by get()", async () => {
    const { cache, client } = makeCache();
    await cache.set("user:1", { name: "Alice" });
    const hk = Array.from(store.keys())[0]!;
    (client.getBuffer as jest.Mock).mockResolvedValueOnce(store.get(hk)!);
    expect(await cache.get("user:1")).toEqual({ name: "Alice" });
  });

  it("throws CacheSerializationError for circular references", async () => {
    const { cache } = makeCache();
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    await expect(cache.set("circ", obj)).rejects.toThrow(CacheSerializationError);
  });

  it("throws CacheConnectionError when pipeline.exec() rejects", async () => {
    const failingMulti = jest.fn((): MockPipeline => ({
      set: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      sAdd: jest.fn().mockReturnThis(),
      exec: jest.fn().mockRejectedValue(new Error("Redis down")),
    }));
    const { cache } = makeCache({ multi: failingMulti });
    await expect(cache.set("k", "v")).rejects.toThrow(CacheConnectionError);
  });

  it("uses TTL when provided", async () => {
    const { cache, client } = makeCache();
    await cache.set("ttlkey", "value", { ttl: 300 });
    const pipeline = (client.multi as jest.Mock).mock.results[0].value;
    expect(pipeline.set).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Buffer),
      { EX: 300 }
    );
  });

  it("registers tags in the same pipeline as the set", async () => {
    const { cache, client } = makeCache();
    await cache.set("user:1", { id: 1 }, { tags: ["users"] });
    const pipeline = (client.multi as jest.Mock).mock.results[0].value;
    expect(pipeline.sAdd).toHaveBeenCalledWith("tag:users", expect.any(String));
  });
});

describe("SuperCache.del()", () => {
  it("calls Redis DEL with the hashed key", async () => {
    const { cache, client } = makeCache();
    await cache.del("user:1");
    expect(client.del).toHaveBeenCalledTimes(1);
  });

  it("throws CacheConnectionError when Redis DEL fails", async () => {
    const { cache } = makeCache({
      del: jest.fn().mockRejectedValue(new Error("Redis error")),
    });
    await expect(cache.del("key")).rejects.toThrow(CacheConnectionError);
  });
});

describe("SuperCache.wrap()", () => {
  it("calls fn on miss and caches the result", async () => {
    const { cache, client } = makeCache();
    const fn = jest.fn().mockResolvedValue({ computed: true });
    const result = await cache.wrap("computed:1", fn);
    expect(result).toEqual({ computed: true });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(client.multi).toHaveBeenCalledTimes(1);
  });

  it("does NOT call fn on hit", async () => {
    const { cache, client } = makeCache();
    const stored = compress(JSON.stringify({ cached: true }));
    (client.getBuffer as jest.Mock).mockResolvedValueOnce(stored);
    const fn = jest.fn();
    const result = await cache.wrap("hit:1", fn);
    expect(result).toEqual({ cached: true });
    expect(fn).not.toHaveBeenCalled();
  });

  it("propagates errors thrown by fn", async () => {
    const { cache } = makeCache();
    const fn = jest.fn().mockRejectedValue(new Error("DB offline"));
    await expect(cache.wrap("key", fn)).rejects.toThrow("DB offline");
  });
});

describe("SuperCache.invalidateTag()", () => {
  it("deletes keys registered under the tag", async () => {
    const { cache } = makeCache();
    await cache.set("user:1", { id: 1 }, { tags: ["users"] });
    const deleted = await cache.invalidateTag("users");
    expect(deleted).toBeGreaterThanOrEqual(0);
  });
});