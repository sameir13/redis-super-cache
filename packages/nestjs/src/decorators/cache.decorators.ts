import type { CacheOptions } from "tagcache";

export interface CacheableHost {
  tagCache?: import("tagcache").TagCache;
}

export interface CacheableOptions extends CacheOptions {
  key?: string | ((...args: unknown[]) => string);
  namespace?: string;
}

export interface CacheEvictOptions {
  key?: string | ((...args: unknown[]) => string);
  tags?: string[];
  allEntries?: boolean;
}

function resolveKey(
  target: object,
  propertyKey: string,
  args: unknown[],
  keyOption?: string | ((...args: unknown[]) => string)
): string {
  if (typeof keyOption === "function") {
    return keyOption(...args);
  }
  if (typeof keyOption === "string") {
    return keyOption;
  }
  return `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`;
}

export function Cacheable(options: CacheableOptions = {}): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) => {
    const original = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (this: CacheableHost, ...args: unknown[]) {
      const cache = this.tagCache;
      if (!cache) {
        throw new Error(
          `@Cacheable requires @InjectTagCache() tagCache property on ${target.constructor.name}`
        );
      }

      const key = resolveKey(target, String(propertyKey), args, options.key);
      const fullKey = options.namespace ? `${options.namespace}:${key}` : key;

      return cache.wrap(
        fullKey,
        () => original.apply(this, args),
        { ttl: options.ttl, tags: options.tags }
      );
    };

    return descriptor;
  };
}

export function CacheEvict(options: CacheEvictOptions = {}): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) => {
    const original = descriptor.value as (...args: unknown[]) => Promise<unknown>;

    descriptor.value = async function (this: CacheableHost, ...args: unknown[]) {
      const result = await original.apply(this, args);
      const cache = this.tagCache;

      if (!cache) {
        return result;
      }

      if (options.tags?.length) {
        await cache.invalidateTags(options.tags);
      }

      if (options.key) {
        const key = resolveKey(target, String(propertyKey), args, options.key);
        await cache.del(key);
      }

      return result;
    };

    return descriptor;
  };
}

export function CacheInvalidateTags(...tags: string[]): MethodDecorator {
  return CacheEvict({ tags });
}
