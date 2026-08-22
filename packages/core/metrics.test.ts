import { createMetrics, metricsEndpoint, resetMetrics } from "./metrics";

describe("metrics", () => {
  beforeEach(() => resetMetrics());

  it("creates metrics for a custom registry", async () => {
    const { Registry } = await import("prom-client");
    const registry = new Registry();
    const metrics = createMetrics(registry);
    metrics.cacheHits.labels({ key_prefix: "tc" }).inc();
    const text = await metricsEndpoint(registry);
    expect(text).toContain("redis_cache_hits_total");
  });

  it("reuses metrics for the same registry", () => {
    const { Registry } = require("prom-client");
    const registry = new Registry();
    expect(createMetrics(registry)).toBe(createMetrics(registry));
  });
});
