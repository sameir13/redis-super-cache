# Benchmarks

You will learn:

- Expected memory savings from compression
- Round-trip improvements from pipelining
- Stampede protection behavior

> Run benchmarks in your environment — numbers vary by payload and network latency.

## Compression (JSON payloads)

| Payload size | Uncompressed | Compressed (deflate) | Savings |
|---|---|---|---|
| 500 B | stored as-is | stored as-is | 0% |
| 4 KB JSON | ~4 KB | ~0.8–1.5 KB | 60–80% |
| 40 KB JSON | ~40 KB | ~8–15 KB | 60–75% |

Threshold default: 1024 bytes.

## Pipeline batching (set + 2 tags)

| Approach | Round trips |
|---|---|
| Without pipeline | 3 |
| redis-super-cache pipeline | 1 |

At 50 ms RTT, saves ~100 ms per write.

## Tag invalidation (N keys)

| Keys in tag | Round trips |
|---|---|
| 1 | 2 |
| 10,000 | 2 |

## Stampede protection

Concurrent `wrap()` on the same key:

| Without singleflight | With redis-super-cache |
|---|---|
| N concurrent DB calls | 1 DB call |

## How to reproduce locally

```bash
# Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# Run integration tests
REDIS_URL=redis://127.0.0.1:6379 npm run test:integration -w redis-super-cache
```
