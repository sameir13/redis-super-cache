import { warmCache } from "./warmup";
import type { TagCache } from "./cache";

function makeMockCache() {
  return {
    wrap: jest.fn(),
    exists: jest.fn(),
  } as unknown as TagCache;
}

describe("warmCache()", () => {
  it("calls wrap() for each task", async () => {
    const cache = makeMockCache();
    (cache.wrap as jest.Mock).mockResolvedValue("value");
    (cache.exists as jest.Mock).mockResolvedValue(false);

    const results = await warmCache(
      cache,
      [{ key: "k1", worker: jest.fn().mockResolvedValue(1) }],
      false
    );

    expect(cache.wrap).toHaveBeenCalledTimes(1);
    expect(results[0]).toEqual({ key: "k1", success: true });
  });

  it("skips worker when key exists and force is false", async () => {
    const cache = makeMockCache();
    (cache.exists as jest.Mock).mockResolvedValue(true);

    const results = await warmCache(
      cache,
      [{ key: "k1", worker: jest.fn() }],
      false
    );

    expect(cache.wrap).not.toHaveBeenCalled();
    expect(results[0]).toEqual({ key: "k1", success: true, skipped: true });
  });

  it("isolates individual task failures", async () => {
    const cache = makeMockCache();
    (cache.exists as jest.Mock).mockResolvedValue(false);
    (cache.wrap as jest.Mock)
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce("ok");

    const results = await warmCache(
      cache,
      [
        { key: "fail", worker: jest.fn() },
        { key: "pass", worker: jest.fn() },
      ],
      false
    );

    expect(results[0]?.success).toBe(false);
    expect(results[1]?.success).toBe(true);
  });

  it("logs warmup summary when tasks fail", async () => {
    const cache = makeMockCache();
    (cache.exists as jest.Mock).mockResolvedValue(false);
    (cache.wrap as jest.Mock).mockRejectedValue(new Error("fail"));
    const logger = { warn: jest.fn(), error: jest.fn() };

    await warmCache(cache, [{ key: "k1", worker: jest.fn() }], logger);

    expect(logger.warn).toHaveBeenCalled();
  });

  it("forces warmup when force is true even if key exists", async () => {
    const cache = makeMockCache();
    (cache.exists as jest.Mock).mockResolvedValue(true);
    (cache.wrap as jest.Mock).mockResolvedValue("ok");

    await warmCache(
      cache,
      [{ key: "k1", worker: jest.fn(), force: true }],
      false
    );

    expect(cache.wrap).toHaveBeenCalled();
  });
});
