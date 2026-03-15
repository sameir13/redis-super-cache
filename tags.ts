import type { RedisClientType } from "redis";
import { CacheConnectionError } from "./errors";
import { tagSize } from "./metrics";

/**
 * Registers a hashed cache key under a tag. Called during set() for every tag
 * in CacheOptions.tags. Uses the same Redis client instance as the cache.
 */
export async function addTagsToKey(
  client: RedisClientType,
  hashedKey: string,
  tags: string[]
): Promise<void> {
  if (tags.length === 0) return;

  try {
    const pipeline = client.multi();
    for (const tag of tags) {
      pipeline.sAdd(`tag:${tag}`, hashedKey);
    }
    await pipeline.exec();

    // Update tag size gauges (fire-and-forget, non-critical)
    for (const tag of tags) {
      client
        .sCard(`tag:${tag}`)
        .then((size) => tagSize.labels({ tag }).set(size))
        .catch(() => {
          /* non-critical */
        });
    }
  } catch (err) {
    throw new CacheConnectionError("Failed to register cache tags", err);
  }
}

/**
 * Deletes all keys registered under a tag and then removes the tag set itself.
 * Uses a pipeline for minimal round trips.
 *
 * @returns The number of keys that were deleted.
 */
export async function invalidateTag(
  client: RedisClientType,
  tag: string
): Promise<number> {
  try {
    const tagKey = `tag:${tag}`;
    const keys = await client.sMembers(tagKey);

    if (keys.length === 0) {
      tagSize.labels({ tag }).set(0);
      return 0;
    }

    const pipeline = client.multi();
    for (const key of keys) {
      pipeline.del(key);
    }
    pipeline.del(tagKey);
    await pipeline.exec();

    tagSize.labels({ tag }).set(0);
    return keys.length;
  } catch (err) {
    throw new CacheConnectionError(
      `Failed to invalidate tag "${tag}"`,
      err
    );
  }
}

/**
 * Invalidates multiple tags in parallel.
 *
 * @returns Total number of keys deleted across all tags.
 */
export async function invalidateTags(
  client: RedisClientType,
  tags: string[]
): Promise<number> {
  const results = await Promise.all(
    tags.map((tag) => invalidateTag(client, tag))
  );
  return results.reduce((sum, n) => sum + n, 0);
}
