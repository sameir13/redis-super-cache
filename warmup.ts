import type { SuperCache } from "./cache";
import type { WarmTask, Logger } from "./types";

export interface WarmupResult {
  key: string;
  success: boolean;
  error?: unknown;
}

/**
 * Pre-populates the cache with a set of tasks at startup.
 * Each task is executed in parallel. Individual task failures are caught and
 * reported in the results array — one broken task never aborts the others.
 *
 * @param cache   - SuperCache instance to warm
 * @param tasks   - Array of warmup task definitions
 * @param logger  - Optional logger; pass `false` to silence output
 * @returns       - Per-task success/failure results
 *
 * @example
 * ```ts
 * await warmCache(cache, [
 *   { key: "home:featured", worker: getFeaturedItems, ttl: 3600 },
 *   { key: "config:global",  worker: getGlobalConfig,  ttl: 86400 },
 * ]);
 * ```
 */
export async function warmCache(
  cache: SuperCache,
  tasks: WarmTask[],
  logger: Logger | false = console
): Promise<WarmupResult[]> {
  const results = await Promise.all(
    tasks.map(async (task): Promise<WarmupResult> => {
      try {
        await cache.wrap(task.key, task.worker, {
          ttl: task.ttl,
          tags: task.tags,
        });
        return { key: task.key, success: true };
      } catch (err) {
        if (logger) {
          logger.warn(
            `[redis-super-cache] Warmup failed for key "${task.key}":`,
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
        `[redis-super-cache] Warmup completed with ${failed.length}/${tasks.length} failures`
      );
    }
  }

  return results;
}
