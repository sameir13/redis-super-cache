import "reflect-metadata";
import { Module, Injectable, Controller, Get, Param } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  TagCacheModule,
  InjectTagCache,
  Cacheable,
  CacheEvict,
} from "@tagcache/nestjs";
import type { TagCache } from "tagcache";

@Injectable()
class UsersService {
  @InjectTagCache() tagCache!: TagCache;

  @Cacheable({
    key: (id: number) => `user:${id}`,
    ttl: 3600,
    tags: ["users"],
    namespace: "demo",
  })
  async findOne(id: number) {
    return { id, name: `User ${id}` };
  }

  @CacheEvict({ tags: ["users"] })
  async invalidateAll() {
    return { ok: true };
  }
}

@Controller("users")
class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.users.findOne(Number(id));
  }
}

@Module({
  imports: [
    TagCacheModule.forRoot({
      isGlobal: true,
      redis: { url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379" },
      enableMetricsController: true,
      warmup: [
        {
          key: "config:global",
          worker: async () => ({ theme: "dark" }),
          ttl: 86400,
        },
      ],
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
  console.log("NestJS example: http://localhost:3000/users/1");
}

bootstrap();
