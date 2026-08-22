import type { TagCache } from "./cache";
import type { WarmTask, Logger } from "./types";

export interface WarmupResult {
  key: string;
  success: boolean;
  skipped?: boolean;
  error?: unknown;
}

export async function warmCache(
  cache: TagCache,
  tasks: WarmTask[],
  logger: Logger | false = console
): Promise<WarmupResult[]> {
  const results = await Promise.all(
    tasks.map(async (task): Promise<WarmupResult> => {
      try {
        if (!task.force && (await cache.exists(task.key))) {
          return { key: task.key, success: true, skipped: true };
        }

        await cache.wrap(task.key, task.worker, {
          ttl: task.ttl,
          tags: task.tags,
        });
        return { key: task.key, success: true };
      } catch (err) {
        if (logger) {
          logger.warn(
            `[tagcache] Warmup failed for key "${task.key}":`,
            err
          );
        }
        return { key: task.key, success: false, error: err };
      }
    })
  );

  if (logger) {
    const failed = results.filter((r) => !r.success);
    if (failed.length > 0) {
      logger.warn(
        `[tagcache] Warmup completed with ${failed.length}/${tasks.length} failures`
      );
    }
  }

  return results;
}
