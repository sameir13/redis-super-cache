import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { TagCacheModule } from "./tag-cache.module";
import { TAG_CACHE } from "./tag-cache.constants";

describe("TagCacheModule", () => {
  it("compiles with forRoot using existing mock client", async () => {
    const mockClient = {
      getBuffer: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      multi: jest.fn(),
      sMembers: jest.fn(),
      sAdd: jest.fn(),
      sRem: jest.fn(),
      sCard: jest.fn(),
      isOpen: true,
      disconnect: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        TagCacheModule.forRoot({
          isGlobal: true,
          redis: { client: mockClient as never },
        }),
      ],
    }).compile();

    const cache = moduleRef.get(TAG_CACHE);
    expect(cache).toBeDefined();
    expect(cache.wrap).toBeDefined();
  });
});

describe("Cacheable decorator", () => {
  it("uses tagCache.wrap on the host class", async () => {
    const { Cacheable } = await import("./decorators/cache.decorators");

    class UsersService {
      tagCache = {
        wrap: jest.fn().mockResolvedValue({ id: 1 }),
      };

      @Cacheable({ key: "user:1", ttl: 60 })
      async findOne() {
        return { id: 1 };
      }
    }

    const svc = new UsersService();
    const result = await svc.findOne();
    expect(result).toEqual({ id: 1 });
    expect(svc.tagCache.wrap).toHaveBeenCalled();
  });
});
