/**
 * Redis cache key for the public, unauthenticated session-packages catalog.
 *
 * The catalog is a single computed payload (no per-request params), so it lives
 * under one fixed key. Invalidate it with `CacheService.invalidatePrefix` after
 * any mutation that can change which packages are public/active/archived, their
 * items, or the pricing inputs they reference (services / departments /
 * categories / duration options).
 */
export const PUBLIC_PACKAGES_CACHE_KEY = 'ref:public-packages';

/** TTL for the public packages catalog (seconds). */
export const PUBLIC_PACKAGES_CACHE_TTL_SECONDS = 300; // 5 minutes
