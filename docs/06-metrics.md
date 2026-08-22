# Metrics

You will learn:

- Which metrics redis-super-cache exports
- How to scrape with Prometheus
- How to use a custom registry

## Built-in metrics

| Metric | Type | Description |
|---|---|---|
| `redis_cache_hits_total` | Counter | Cache hits |
| `redis_cache_misses_total` | Counter | Cache misses |
| `redis_cache_errors_total` | Counter | Errors by operation |
| `redis_cache_latency_ms` | Histogram | Operation latency |
| `redis_cache_tag_size` | Gauge | Keys per tag |

## Express endpoint

```ts
import express from "express";
import { metricsEndpoint } from "redis-super-cache";

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", "text/plain");
  res.send(await metricsEndpoint());
});
```

## NestJS

Enable `enableMetricsController: true` in `TagCacheModule.forRoot()`.

## Custom registry

```ts
import { Registry } from "prom-client";
import { createTagCache, metricsEndpoint } from "redis-super-cache";

const registry = new Registry();
const cache = createTagCache({ client, metricsRegistry: registry });
const text = await metricsEndpoint(registry);
```

## Grafana tips

- Alert on `rate(redis_cache_errors_total[5m]) > 0`
- Track hit ratio: `hits / (hits + misses)`
