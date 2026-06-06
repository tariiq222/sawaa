import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

/** Default TTL for reference data — services, branches, categories, etc. */
export const REFERENCE_DATA_TTL_SECONDS = 3600; // 1 hour

/**
 * Thin JSON cache over the shared Redis client.
 *
 * Designed for read-through caching of slow-changing reference data. All cache
 * operations are best-effort: a Redis hiccup must never break a request, so
 * read/write failures are logged and the caller falls back to the source of
 * truth (the loader). This is intentional — a degraded cache should degrade
 * latency, not availability.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Read-through cache. Returns the cached value for `key` if present, otherwise
   * runs `loader`, caches its result under `key` with `ttlSeconds`, and returns
   * it. Cache failures fall through to the loader (never throw).
   */
  async getOrSet<T>(
    key: string,
    loader: () => Promise<T>,
    ttlSeconds: number = REFERENCE_DATA_TTL_SECONDS,
  ): Promise<T> {
    const cached = await this.read<T>(key);
    if (cached !== undefined) return cached;

    const value = await loader();
    await this.write(key, value, ttlSeconds);
    return value;
  }

  /** Reads and JSON-parses a key. Returns undefined on miss or any error. */
  private async read<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.redis.getClient().get(key);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    } catch (err) {
      this.logger.warn(`cache read failed [${key}]: ${err instanceof Error ? err.message : err}`);
      return undefined;
    }
  }

  /** JSON-serializes and stores a key with TTL. Swallows errors (best-effort). */
  private async write(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.getClient().set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(`cache write failed [${key}]: ${err instanceof Error ? err.message : err}`);
    }
  }

  /**
   * Deletes every key matching `prefix:*` (and the bare `prefix`). Used to
   * invalidate a whole reference-data namespace after a mutation. Uses SCAN to
   * avoid blocking Redis on large keyspaces.
   */
  async invalidatePrefix(prefix: string): Promise<void> {
    const client = this.redis.getClient();
    const pattern = `${prefix}*`;
    try {
      let cursor = '0';
      do {
        const [next, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
        cursor = next;
        if (keys.length > 0) await client.del(...keys);
      } while (cursor !== '0');
    } catch (err) {
      this.logger.warn(
        `cache invalidate failed [${pattern}]: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
