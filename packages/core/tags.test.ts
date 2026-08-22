import {
  addTagsToKey,
  cleanupTag,
  invalidateTag,
  invalidateTags,
  removeKeyFromTags,
} from "./tags";
import { createMetrics, resetMetrics } from "./metrics";
import { tagKey } from "./key";

const store = new Map<string, Buffer>();
const sets = new Map<string, Set<string>>();

function mockClient() {
  return {
    multi: jest.fn(() => {
      const ops: Array<() => void> = [];
      const pipeline: {
        sAdd: jest.Mock;
        del: jest.Mock;
        sRem: jest.Mock;
        exec: jest.Mock;
      } = {
        sAdd: jest.fn((k: string, m: string) => {
          ops.push(() => {
            if (!sets.has(k)) sets.set(k, new Set());
            sets.get(k)!.add(m);
          });
          return pipeline;
        }),
        del: jest.fn((...keys: string[]) => {
          ops.push(() => keys.forEach((k) => sets.delete(k)));
          return pipeline;
        }),
        sRem: jest.fn((k: string, m: string) => {
          ops.push(() => sets.get(k)?.delete(m));
          return pipeline;
        }),
        exec: jest.fn(async () => ops.forEach((o) => o())),
      };
      return pipeline;
    }),
    sMembers: jest.fn(async (k: string) => Array.from(sets.get(k) ?? [])),
    sRem: jest.fn(async (k: string, m: string) => {
      sets.get(k)?.delete(m);
      return 1;
    }),
    sCard: jest.fn(async (k: string) => sets.get(k)?.size ?? 0),
    exists: jest.fn(async (k: string) => (store.has(k) || sets.has(k) ? 1 : 0)),
  };
}

beforeEach(() => {
  store.clear();
  sets.clear();
  resetMetrics();
});

describe("tags helpers", () => {
  const metrics = createMetrics();

  it("invalidateTag returns 0 for empty tag", async () => {
    const client = mockClient();
    expect(await invalidateTag(client as never, "users", "tc", metrics)).toBe(0);
  });

  it("invalidateTags sums deletions", async () => {
    const client = mockClient();
    sets.set(tagKey("a", "tc"), new Set(["k1"]));
    sets.set(tagKey("b", "tc"), new Set(["k2"]));
    const total = await invalidateTags(client as never, ["a", "b"], "tc", metrics);
    expect(total).toBe(2);
  });

  it("removeKeyFromTags clears meta membership", async () => {
    const client = mockClient();
    const hk = "tc:abc";
    sets.set(`${hk}:meta`, new Set(["users"]));
    sets.set(tagKey("users", "tc"), new Set([hk]));
    await removeKeyFromTags(client as never, hk, "tc", metrics);
    expect(sets.get(tagKey("users", "tc"))?.has(hk)).toBeFalsy();
  });

  it("addTagsToKey registers tag and meta", async () => {
    const client = mockClient();
    await addTagsToKey(client as never, "tc:abc", ["users"], "tc", metrics);
    expect(sets.get(tagKey("users", "tc"))?.has("tc:abc")).toBe(true);
  });

  it("cleanupTag removes stale tag members", async () => {
    const client = mockClient();
    const hk = "tc:stale";
    sets.set(tagKey("users", "tc"), new Set([hk]));
    sets.set(`${hk}:meta`, new Set(["users"]));
    store.delete(hk);
    const removed = await cleanupTag(client as never, "users", "tc", metrics);
    expect(removed).toBe(1);
  });
});
