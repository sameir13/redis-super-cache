import {
  DynamicModule,
  Inject,
  Module,
  OnModuleDestroy,
  Provider,
} from "@nestjs/common";
import { createClient, type RedisClientType } from "redis";
import {
  createTagCache,
  warmCache,
  type TagCache,
  type WarmTask,
  type CacheConfig,
} from "redis-super-cache";
import {
  TAG_CACHE,
  TAG_CACHE_MODULE_OPTIONS,
} from "./tag-cache.constants";
import { TagCacheMetricsController } from "./tag-cache-metrics.controller";

export interface TagCacheRedisOptions {
  url?: string;
  client?: RedisClientType;
}

export interface TagCacheModuleOptions {
  isGlobal?: boolean;
  redis: TagCacheRedisOptions;
  keyPrefix?: string;
  namespace?: string;
  compressionThreshold?: number;
  stampedeProtection?: boolean;
  warmup?: WarmTask[];
  enableMetricsController?: boolean;
}

export interface TagCacheModuleAsyncOptions {
  isGlobal?: boolean;
  imports?: DynamicModule["imports"];
  inject?: unknown[];
  enableMetricsController?: boolean;
  useFactory: (
    ...args: unknown[]
  ) => Promise<TagCacheModuleOptions> | TagCacheModuleOptions;
}

class TagCacheLifecycle implements OnModuleDestroy {
  constructor(
    @Inject(TAG_CACHE_MODULE_OPTIONS)
    private readonly options: TagCacheModuleOptions
  ) {}

  async onModuleDestroy(): Promise<void> {
    const client = this.options.redis.client;
    if (client?.isOpen) {
      await client.disconnect();
    }
  }
}

@Module({})
export class TagCacheModule {
  static forRoot(options: TagCacheModuleOptions): DynamicModule {
    return TagCacheModule.buildModule(options);
  }

  static forRootAsync(options: TagCacheModuleAsyncOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: TAG_CACHE_MODULE_OPTIONS,
      useFactory: options.useFactory,
      inject: (options.inject ?? []) as never[],
    };

    return TagCacheModule.buildModuleAsync(options, optionsProvider);
  }

  private static buildModule(options: TagCacheModuleOptions): DynamicModule {
    const providers: Provider[] = [
      { provide: TAG_CACHE_MODULE_OPTIONS, useValue: options },
      TagCacheModule.createCacheProvider(),
    ];

    if (!options.redis.client) {
      providers.push(TagCacheLifecycle);
    }

    const controllers = options.enableMetricsController
      ? [TagCacheMetricsController]
      : [];

    return {
      module: TagCacheModule,
      global: options.isGlobal ?? false,
      providers,
      controllers,
      exports: [TAG_CACHE],
    };
  }

  private static buildModuleAsync(
    options: TagCacheModuleAsyncOptions,
    optionsProvider: Provider
  ): DynamicModule {
    return {
      module: TagCacheModule,
      global: options.isGlobal ?? false,
      imports: options.imports ?? [],
      providers: [
        optionsProvider,
        TagCacheModule.createCacheProvider(),
        TagCacheLifecycle,
      ],
      controllers: options.enableMetricsController
        ? [TagCacheMetricsController]
        : [],
      exports: [TAG_CACHE],
    };
  }

  private static createCacheProvider(): Provider {
    return {
      provide: TAG_CACHE,
      useFactory: async (
        options: TagCacheModuleOptions
      ): Promise<TagCache> => {
        let client = options.redis.client;
        let ownedClient = false;

        if (!client) {
          client = createClient({
            url: options.redis.url ?? "redis://127.0.0.1:6379",
          });
          await client.connect();
          ownedClient = true;
          options.redis.client = client;
        }

        const config: CacheConfig = {
          client: client as never,
          keyPrefix: options.keyPrefix,
          namespace: options.namespace,
          compressionThreshold: options.compressionThreshold,
          stampedeProtection: options.stampedeProtection,
          logger: false,
        };

        const cache = createTagCache(config);

        if (options.warmup?.length) {
          await warmCache(cache, options.warmup, false);
        }

        if (ownedClient) {
          // stored on options for lifecycle teardown
        }

        return cache;
      },
      inject: [TAG_CACHE_MODULE_OPTIONS],
    };
  }
}
