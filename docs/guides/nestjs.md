# NestJS complete guide

You will learn:

- How to register `TagCacheModule` in a NestJS app
- How to use `@Cacheable` and `@CacheEvict` on services
- How to enable metrics, warmup, and async configuration

**Time:** ~30 minutes  
**Stack:** NestJS 10+, `redis-super-cache-nestjs`, Redis Super Cache, Redis

---

## What we are building

```text
src/
  main.ts
  app.module.ts
  users/
    users.module.ts
    users.controller.ts
    users.service.ts
```

| Endpoint | Description |
|---|---|
| `GET /users/:id` | Cached user lookup (`@Cacheable`) |
| `PUT /users/:id` | Update + evict cache (`@CacheEvict`) |
| `GET /metrics` | Prometheus (via `TagCacheMetricsController`) |

---

## Step 1 — Create NestJS project

```bash
npm i -g @nestjs/cli
nest new redis-super-cache-nest-demo
cd redis-super-cache-nest-demo
```

Or manual setup:

```bash
mkdir redis-super-cache-nest-demo && cd redis-super-cache-nest-demo
npm init -y
npm install @nestjs/common @nestjs/core @nestjs/platform-express reflect-metadata rxjs
npm install redis-super-cache redis-super-cache-nestjs redis
npm install -D typescript @types/node ts-node
```

---

## Step 2 — Install redis-super-cache packages

```bash
npm install redis-super-cache redis-super-cache-nestjs redis
```

---

## Step 3 — Environment

Create `.env`:

```env
REDIS_URL=redis://127.0.0.1:6379
PORT=3000
```

Start Redis:

```bash
docker run -d --name redis-super-cache-redis -p 6379:6379 redis:7-alpine
```

---

## Step 4 — Fake users repository

Create `src/users/users.repository.ts`:

```ts
import { Injectable } from "@nestjs/common";

export interface User {
  id: number;
  name: string;
  email: string;
}

@Injectable()
export class UsersRepository {
  private readonly users = new Map<number, User>([
    [1, { id: 1, name: "Alice", email: "alice@example.com" }],
    [2, { id: 2, name: "Bob", email: "bob@example.com" }],
  ]);

  async findById(id: number): Promise<User | null> {
    await this.delay(150);
    console.log(`[db] findById(${id})`);
    return this.users.get(id) ?? null;
  }

  async update(id: number, patch: Partial<User>): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;
    const updated = { ...user, ...patch };
    this.users.set(id, updated);
    console.log(`[db] update(${id})`);
    return updated;
  }

  private delay(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }
}
```

---

## Step 5 — Users service with decorators

Create `src/users/users.service.ts`:

```ts
import { Injectable, NotFoundException } from "@nestjs/common";
import {
  InjectTagCache,
  Cacheable,
  CacheEvict,
} from "redis-super-cache-nestjs";
import type { TagCache } from "redis-super-cache";
import { UsersRepository, User } from "./users.repository";

@Injectable()
export class UsersService {
  /** Required property name for @Cacheable / @CacheEvict */
  @InjectTagCache()
  tagCache!: TagCache;

  constructor(private readonly repo: UsersRepository) {}

  @Cacheable({
    key: (id: number) => `user:${id}`,
    ttl: 3600,
    tags: ["users"],
  })
  async findOne(id: number): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  @CacheEvict({
    key: (id: number) => `user:${id}`,
    tags: ["users"],
  })
  async update(id: number, patch: Partial<User>): Promise<User> {
    const user = await this.repo.update(id, patch);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }
}
```

**Important:** The property must be named `tagCache` and use `@InjectTagCache()`.

---

## Step 6 — Users controller

Create `src/users/users.controller.ts`:

```ts
import { Body, Controller, Get, Param, ParseIntPipe, Put } from "@nestjs/common";
import { UsersService } from "./users.service";
import type { User } from "./users.repository";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Put(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: Partial<User>
  ) {
    return this.usersService.update(id, body);
  }
}
```

---

## Step 7 — Users module

Create `src/users/users.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { UsersRepository } from "./users.repository";

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
})
export class UsersModule {}
```

---

## Step 8 — App module with TagCacheModule

Create `src/app.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { TagCacheModule } from "redis-super-cache-nestjs";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    TagCacheModule.forRoot({
      isGlobal: true,
      redis: {
        url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
      },
      keyPrefix: "tc",
      stampedeProtection: true,
      enableMetricsController: true,
      warmup: [
        {
          key: "user:1",
          worker: async () => ({ id: 1, name: "Alice", email: "alice@example.com" }),
          ttl: 3600,
          tags: ["users"],
        },
      ],
    }),
    UsersModule,
  ],
})
export class AppModule {}
```

**What `forRoot` does:**

1. Connects to Redis on module init
2. Creates a global `TagCache` instance (`TAG_CACHE` token)
3. Runs warmup tasks (skips keys that already exist)
4. Registers `GET /metrics` when `enableMetricsController: true`
5. Disconnects Redis on app shutdown

---

## Step 9 — Main bootstrap

Create `src/main.ts`:

```ts
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`NestJS running at http://localhost:${port}`);
}

bootstrap();
```

---

## Step 10 — TypeScript config

`tsconfig.json` must include:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2020",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strict": true,
    "outDir": "./dist",
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

---

## Step 11 — Run the app

```bash
npx ts-node src/main.ts
# or with nest cli: npm run start:dev
```

---

## Step 12 — Test with curl

```bash
# First request — DB hit (~150ms)
curl -s http://localhost:3000/users/1 | jq

# Second request — cache hit (fast)
curl -s http://localhost:3000/users/1 | jq

# Update — evicts cache
curl -s -X PUT http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Smith"}' | jq

# Next GET hits DB again
curl -s http://localhost:3000/users/1 | jq

# Prometheus metrics
curl -s http://localhost:3000/metrics | grep redis_cache
```

---

## Step 13 — Async configuration (production)

Use `ConfigModule` for Redis URL:

```bash
npm install @nestjs/config
```

```ts
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TagCacheModule } from "redis-super-cache-nestjs";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TagCacheModule.forRootAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      enableMetricsController: true,
      useFactory: (config: ConfigService) => ({
        redis: { url: config.get<string>("REDIS_URL") },
        keyPrefix: "tc",
        stampedeProtection: true,
      }),
    }),
  ],
})
export class AppModule {}
```

---

## Step 14 — SaaS multi-tenant pattern

Scope keys and tags by `client_id`:

```ts
@Cacheable({
  key: (clientId: string, userId: number) => `${clientId}:user:${userId}`,
  ttl: 3600,
  // Use client-scoped tag strings in invalidateTag after updates
})
async findUser(clientId: string, userId: number) {
  return this.repo.findById(userId);
}

async updateUser(clientId: string, id: number, data: Partial<User>) {
  const user = await this.repo.update(id, data);
  await this.tagCache.invalidateTag(`${clientId}:users`);
  return user;
}
```

Or set a static namespace per deployment:

```ts
TagCacheModule.forRoot({
  namespace: process.env.CLIENT_ID,
  redis: { url: process.env.REDIS_URL },
});
```

---

## Step 15 — Manual injection (without decorators)

```ts
import { Injectable } from "@nestjs/common";
import { InjectTagCache } from "redis-super-cache-nestjs";
import type { TagCache } from "redis-super-cache";

@Injectable()
export class ReportsService {
  constructor(@InjectTagCache() private readonly cache: TagCache) {}

  async getReport(id: string) {
    return this.cache.wrap(
      `report:${id}`,
      () => this.buildReport(id),
      { ttl: 600, tags: ["reports"] }
    );
  }
}
```

---

## Decorator reference

| Decorator | When it runs | Options |
|---|---|---|
| `@Cacheable()` | Before method | `key`, `ttl`, `tags`, `namespace` |
| `@CacheEvict()` | After method succeeds | `key`, `tags` |
| `@CacheInvalidateTags('a','b')` | After method succeeds | tag names |

All `@Cacheable` calls use `wrap()` internally → **stampede protection included**.

---

## Troubleshooting

| Issue | Solution |
|---|---|
| `@Cacheable requires tagCache property` | Add `@InjectTagCache() tagCache!: TagCache` |
| Decorators not working | Ensure `reflect-metadata` imported in `main.ts` |
| Redis connection error | Check `REDIS_URL` and Docker container |
| `/metrics` 404 | Set `enableMetricsController: true` |

---

## Full project tree

```text
redis-super-cache-nest-demo/
  src/
    main.ts
    app.module.ts
    users/
      users.module.ts
      users.controller.ts
      users.service.ts
      users.repository.ts
  package.json
  tsconfig.json
```

---

## Next steps

- [Express guide](./express.md)
- [Node.js guide](./nodejs.md)
- [Tags reference](../04-tags.md)
- [Configuration](../08-configuration.md)
