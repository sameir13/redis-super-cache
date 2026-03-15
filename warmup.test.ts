import { warmCache } from "./warmup";
import type { SuperCache } from "./cache";

function makeMockCache() {
  return {
    wrap: jest.fn(),
  } as unknown as SuperCache;
}

describe("warmCache()", () => {
  it("calls wrap() for each task", async () => {
    const cache = makeMockCache();
    (cache.wrap as jest.Mock).mockResolvedValue("value");

    const tasks = [
      { key: "k1", worker: jest.fn().mockResolvedValue(1) },
      { key: "k2", worker: jest.fn().mockResolvedValue(2) },
    ];

    const results = await warmCache(cache, tasks, false);

    expect(cache.wrap).toHaveBeenCalledTimes(2);
    expect(results).toEqual([
      { key: "k1", success: true },
      { key: "k2", success: true },
    ]);
  });

  it("isolates individual task failures — other tasks still succeed", async () => {
    const cache = makeMockCache();
    (cache.wrap as jest.Mock)
      .mockRejectedValueOnce(new Error("DB timeout")) // task 1 fails
      .mockResolvedValueOnce("ok");                  // task 2 succeeds

    const tasks = [
      { key: "fail", worker: jest.fn() },
      { key: "pass", worker: jest.fn() },
    ];

    const results = await warmCache(cache, tasks, false);

    expect(results[0]).toMatchObject({ key: "fail", success: false });
    expect(results[1]).toMatchObject({ key: "pass", success: true });
  });

  it("returns an empty array for an empty task list", async () => {
    const cache = makeMockCache();
    const results = await warmCache(cache, [], false);
    expect(results).toEqual([]);
  });
});
