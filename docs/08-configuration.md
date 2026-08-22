# Configuration

You will learn:

- All `CacheConfig` options
- NestJS module options
- Recommended production defaults

## CacheConfig

| Option | Type | Default | Description |
|---|---|---|---|
| `client` | `RedisCacheClient` | required | Connected Redis client |
| `keyPrefix` | `string` | `"tc"` | Hash key prefix |
| `namespace` | `string` | — | Tenant/app namespace prepended to prefix |
| `compressionThreshold` | `number` | `1024` | Min bytes before deflate |
| `stampedeProtection` | `boolean` | `true` | Singleflight on `wrap()` |
| `serializer` | `Serializer` | JSON | Custom serialize/deserialize |
| `metricsRegistry` | `Registry` | global | Prometheus registry |
| `logger` | `Logger \| false` | `console` | Internal warnings |

## CacheOptions (set/wrap)

| Option | Type | Description |
|---|---|---|
| `ttl` | `number` | Expiry in seconds |
| `tags` | `string[]` | Tags for bulk invalidation |

## NestJS TagCacheModuleOptions

| Option | Type | Description |
|---|---|---|
| `isGlobal` | `boolean` | Register module globally |
| `redis.url` | `string` | Redis connection URL |
| `redis.client` | `RedisClientType` | Pre-connected client |
| `warmup` | `WarmTask[]` | Startup warmup tasks |
| `enableMetricsController` | `boolean` | Expose `GET /metrics` |

## Production defaults

```ts
createTagCache({
  client,
  keyPrefix: "tc",
  namespace: process.env.TENANT_ID,
  compressionThreshold: 1024,
  stampedeProtection: true,
  logger: false,
});
```
