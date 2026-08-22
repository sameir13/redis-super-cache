import { TagCache } from "./cache";
import { compress } from "./compression";
import { wrapEnvelope } from "./serializer";
import { CacheConnectionError, CacheSerializationError } from "./errors";
import { metaKey, tagKey } from "./key";
import { resetMetrics } from "./metrics";

const store = new Map<string, Buffer>();
const tagStore = new Map<string, Set<string>>();

interface MockPipeline {
  set: jest.Mock;
  del: jest.Mock;
  sAdd: jest.Mock;
  sRem: jest.Mock;
  exec: jest.Mock;
}

function makeMockClient() {
  return {
    getBuffer: jest.fn(async (key: string) => store.get(key) ?? null),

    set: jest.fn(async (key: string, value: Buffer) => {
      store.set(key, value);
      return "OK";
    }),

    exists: jest.fn(async (key: string) => (store.has(key) ? 1 : 0)),

    multi: jest.fn(() => {
      const ops: Array<() => void> = [];
      const pipeline: MockPipeline = {
        set: jest.fn((key: string, value: Buffer, _opts?: unknown) => {
          ops.push(() => store.set(key, value));
          return pipeline;
        }),
        del: jest.fn((...keys: string[]) => {
          ops.push(() => {
            for (const key of keys) store.delete(key);
          });
          return pipeline;
        }),
        sAdd: jest.fn((setKey: string, member: string) => {
          ops.push(() => {
            if (!tagStore.has(setKey)) tagStore.set(setKey, new Set());
            tagStore.get(setKey)!.add(member);
          });
          return pipeline;
        }),
        sRem: jest.fn((setKey: string, member: string) => {
          ops.push(() => tagStore.get(setKey)?.delete(member));
          return pipeline;
        }),
        exec: jest.fn(async () => {
          ops.forEach((op) => op());
        }),
      };
      return pipeline;
    }),

    sMembers: jest.fn(async (setKey: string) =>
      Array.from(tagStore.get(setKey) ?? [])
    ),

    del: jest.fn(async (...keys: string[]) => {
      for (const key of keys) store.delete(key);
      return keys.length;
    }),

    sCard: jest.fn(async (setKey: string) => tagStore.get(setKey)?.size ?? 0),
    sAdd: jest.fn(async (setKey: string, member: string) => {
      if (!tagStore.has(setKey)) tagStore.set(setKey, new Set());
      tagStore.get(setKey)!.add(member);
      return 1;
    }),
    sRem: jest.fn(async (setKey: string, member: string) => {
      tagStore.get(setKey)?.delete(member);
      return 1;
    }),
  };
}

function makeCache(clientOverrides?: Partial<ReturnType<typeof makeMockClient>>) {
  const client = { ...makeMockClient(), ...clientOverrides };
  return {
    cache: new TagCache({ client, logger: false }),
    client,
  };
}

beforeEach(() => {
  store.clear();
  tagStore.clear();
  resetMetrics();
});

describe("TagCache.get()", () => {
  it("returns null on cache miss", async () => {
    const { cache } = makeCache();
    expect(await cache.get("missing")).toBeNull();
  });

  it("returns the stored value on hit", async () => {
    const { cache, client } = makeCache();
    const payload = compress(JSON.stringify(wrapEnvelope({ id: 1 })));
    (client.getBuffer as jest.Mock).mockResolvedValueOnce(payload);
    expect(await cache.get("user:1")).toEqual({ id: 1 });
  });

  it("returns cached null values", async () => {
    const { cache } = makeCache();
    await cache.set("nullable", null);
    expect(await cache.get("nullable")).toBeNull();
    expect(await cache.exists("nullable")).toBe(true);
  });

  it("returns null and does NOT throw when Redis errors", async () => {
    const { cache } = makeCache({
      getBuffer: jest.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    });
    await expect(cache.get("key")).resolves.toBeNull();
  });
});

describe("TagCache.set()", () => {
  it("stores a value retrievable by get()", async () => {
    const { cache } = makeCache();
    await cache.set("user:1", { name: "Alice" });
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
      sRem: jest.fn().mockReturnThis(),
      exec: jest.fn().mockRejectedValue(new Error("Redis down")),
    }));
    const { cache } = makeCache({ multi: failingMulti });
    await expect(cache.set("k", "v")).rejects.toThrow(CacheConnectionError);
  });

  it("registers namespaced tags and meta keys", async () => {
    const { cache, client } = makeCache();
    await cache.set("user:1", { id: 1 }, { tags: ["users"] });
    const pipeline = (client.multi as jest.Mock).mock.results[0].value;
    expect(pipeline.sAdd).toHaveBeenCalledWith("tc:tag:users", expect.any(String));
    expect(pipeline.sAdd).toHaveBeenCalledWith(expect.stringMatching(/:meta$/), "users");
  });
});

describe("TagCache.del()", () => {
  it("removes key and cleans up tag membership", async () => {
    const { cache } = makeCache();
    await cache.set("user:1", { id: 1 }, { tags: ["users"] });
    const hk = Array.from(store.keys()).find((k) => !k.endsWith(":meta"))!;
    await cache.del("user:1");
    expect(store.has(hk)).toBe(false);
    expect(tagStore.get(tagKey("users", "tc"))?.has(hk)).toBeFalsy();
  });
});

describe("TagCache.wrap()", () => {
  it("calls fn on miss and caches the result", async () => {
    const { cache } = makeCache();
    const fn = jest.fn().mockResolvedValue({ computed: true });
    const result = await cache.wrap("computed:1", fn);
    expect(result).toEqual({ computed: true });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does NOT call fn on hit", async () => {
    const { cache } = makeCache();
    await cache.set("hit:1", { cached: true });
    const fn = jest.fn();
    const result = await cache.wrap("hit:1", fn);
    expect(result).toEqual({ cached: true });
    expect(fn).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent wrap calls (stampede protection)", async () => {
    const { cache } = makeCache();
    let calls = 0;
    const fn = jest.fn(async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 50));
      return { ok: true };
    });

    const [a, b, c] = await Promise.all([
      cache.wrap("stampede:1", fn),
      cache.wrap("stampede:1", fn),
      cache.wrap("stampede:1", fn),
    ]);

    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(c).toEqual({ ok: true });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(calls).toBe(1);
  });

  it("propagates errors thrown by fn", async () => {
    const { cache } = makeCache();
    const fn = jest.fn().mockRejectedValue(new Error("DB offline"));
    await expect(cache.wrap("key", fn)).rejects.toThrow("DB offline");
  });
});

describe("TagCache.mget/mset", () => {
  it("returns multiple values", async () => {
    const { cache } = makeCache();
    await cache.mset([
      { key: "a", value: 1 },
      { key: "b", value: 2 },
    ]);
    const map = await cache.mget<number>(["a", "b", "missing"]);
    expect(map.get("a")).toBe(1);
    expect(map.get("b")).toBe(2);
    expect(map.get("missing")).toBeNull();
  });
});

describe("TagCache.invalidateTag()", () => {
  it("deletes keys registered under the tag", async () => {
    const { cache } = makeCache();
    await cache.set("user:1", { id: 1 }, { tags: ["users"] });
    const deleted = await cache.invalidateTag("users");
    expect(deleted).toBe(1);
    expect(await cache.get("user:1")).toBeNull();
  });
});

describe("TagCache.invalidateTags()", () => {
  it("invalidates multiple tags", async () => {
    const { cache } = makeCache();
    await cache.set("u:1", 1, { tags: ["users"] });
    await cache.set("p:1", 1, { tags: ["posts"] });
    const deleted = await cache.invalidateTags(["users", "posts"]);
    expect(deleted).toBe(2);
  });
});

describe("TagCache.addTagsToKey()", () => {
  it("registers tags for an existing key", async () => {
    const { cache } = makeCache();
    await cache.set("user:1", { id: 1 });
    await cache.addTagsToKey("user:1", ["users"]);
    const hk = Array.from(store.keys()).find((k) => !k.endsWith(":meta"))!;
    expect(tagStore.get(tagKey("users", "tc"))?.has(hk)).toBe(true);
  });
});

describe("TagCache.exists()", () => {
  it("returns true when key exists", async () => {
    const { cache } = makeCache();
    await cache.set("exists:1", "yes");
    expect(await cache.exists("exists:1")).toBe(true);
    expect(await cache.exists("nope")).toBe(false);
  });
  it("returns false when exists throws", async () => {
    const { cache } = makeCache({
      exists: jest.fn().mockRejectedValue(new Error("fail")),
    });
    expect(await cache.exists("key")).toBe(false);
  });
});

describe("TagCache.cleanupTag()", () => {
  it("delegates to tag cleanup", async () => {
    const { cache } = makeCache();
    expect(await cache.cleanupTag("users")).toBe(0);
  });
});

describe("metaKey helper", () => {
  it("builds meta key suffix", () => {
    expect(metaKey("tc:abc")).toBe("tc:abc:meta");
  });
});
