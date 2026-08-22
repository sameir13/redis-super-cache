import type { RedisCacheClient } from "./client";
import { CacheConnectionError } from "./errors";
import { metaKey, tagKey } from "./key";
import type { CacheMetrics } from "./metrics";

export async function addTagsToKey(
  client: RedisCacheClient,
  hashedKey: string,
  tags: string[],
  keyPrefix: string,
  metrics: CacheMetrics
): Promise<void> {
  if (tags.length === 0) return;

  try {
    const pipeline = client.multi();
    for (const tag of tags) {
      pipeline.sAdd(tagKey(tag, keyPrefix), hashedKey);
    }
    for (const tag of tags) {
      pipeline.sAdd(metaKey(hashedKey), tag);
    }
    await pipeline.exec();

    for (const tag of tags) {
      client
        .sCard(tagKey(tag, keyPrefix))
        .then((size) => metrics.tagSize.labels({ tag }).set(size))
        .catch(() => undefined);
    }
  } catch (err) {
    throw new CacheConnectionError("Failed to register cache tags", err);
  }
}

export async function invalidateTag(
  client: RedisCacheClient,
  tag: string,
  keyPrefix: string,
  metrics: CacheMetrics
): Promise<number> {
  try {
    const tk = tagKey(tag, keyPrefix);
    const keys = await client.sMembers(tk);

    if (keys.length === 0) {
      metrics.tagSize.labels({ tag }).set(0);
      return 0;
    }

    const pipeline = client.multi();
    for (const key of keys) {
      pipeline.del(key);
      pipeline.del(metaKey(key));
    }
    pipeline.del(tk);
    await pipeline.exec();

    metrics.tagSize.labels({ tag }).set(0);
    return keys.length;
  } catch (err) {
    throw new CacheConnectionError(
      `Failed to invalidate tag "${tag}"`,
      err
    );
  }
}

export async function invalidateTags(
  client: RedisCacheClient,
  tags: string[],
  keyPrefix: string,
  metrics: CacheMetrics
): Promise<number> {
  const results = await Promise.all(
    tags.map((tag) => invalidateTag(client, tag, keyPrefix, metrics))
  );
  return results.reduce((sum, n) => sum + n, 0);
}

export async function removeKeyFromTags(
  client: RedisCacheClient,
  hashedKey: string,
  keyPrefix: string,
  metrics: CacheMetrics
): Promise<void> {
  const mk = metaKey(hashedKey);
  const tags = await client.sMembers(mk);

  if (tags.length === 0) {
    return;
  }

  const pipeline = client.multi();
  for (const tag of tags) {
    pipeline.sRem(tagKey(tag, keyPrefix), hashedKey);
  }
  pipeline.del(mk);
  await pipeline.exec();

  for (const tag of tags) {
    client
      .sCard(tagKey(tag, keyPrefix))
      .then((size) => metrics.tagSize.labels({ tag }).set(size))
      .catch(() => undefined);
  }
}

export async function cleanupTag(
  client: RedisCacheClient,
  tag: string,
  keyPrefix: string,
  metrics: CacheMetrics
): Promise<number> {
  const tk = tagKey(tag, keyPrefix);
  const keys = await client.sMembers(tk);
  let removed = 0;

  for (const key of keys) {
    const exists = await client.exists(key);
    if (exists === 0) {
      await removeKeyFromTags(client, key, keyPrefix, metrics);
      removed++;
    }
  }

  const size = await client.sCard(tk);
  metrics.tagSize.labels({ tag }).set(size);
  return removed;
}
