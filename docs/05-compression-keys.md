# Compression and keys

You will learn:

- How redis-super-cache saves Redis memory
- How key hashing works
- Multi-tenant key namespacing

## Compression

Values are JSON-serialized, then compressed with **fflate deflate** when size ≥ `compressionThreshold` (default 1024 bytes).

Typical JSON savings: **60–80%**.

```ts
createTagCache({ client, compressionThreshold: 2048 });
```

## Key hashing

Logical keys are hashed with xxHash64:

```
"user:profile:1234:settings" → "tc:3f8a2c1d9b047e21"
```

Benefits:

- Short, fixed-size Redis keys
- Safe for long composite keys

## Multi-tenant namespacing

```ts
createTagCache({
  client,
  namespace: "tenant-acme",
  keyPrefix: "tc",
});
// Keys become: tenant-acme:tc:<hash>
```

Use a unique `namespace` per tenant in SaaS apps.

## Custom serializer

```ts
import { jsonSerializer } from "redis-super-cache";

createTagCache({
  client,
  serializer: jsonSerializer, // default
});
```

For Dates/BigInt, plug in `superjson` (see [Configuration](./08-configuration.md)).
