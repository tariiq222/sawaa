/**
 * Signed-image URL refresh policy.
 *
 * The backend mints every media `imageUrl` on read with a short presigned
 * window (`MEDIA_IMAGE_URL_EXPIRY_SECONDS` in
 * `apps/backend/src/modules/media/media-image-url.helper.ts`, currently 300s).
 * Global `QueryProvider` defaults (`components/providers/query-provider.tsx`)
 * optimise for calm caching — `staleTime: 5min`, `refetchOnMount: false`,
 * `refetchOnWindowFocus: false` — so a staff member can hold an expired image
 * link for the full `gcTime` of 10 minutes. Lowering `staleTime` alone is not
 * enough: a compound query (services/categories/packages lists) only refetches
 * when a mount/focus/interval trigger fires, not when data turns stale.
 *
 * Apply `signedImageQueryOptions` ONLY to queries whose payload carries
 * presigned image URLs; leave every other query on the provider defaults.
 *
 * Trade-off: `refetchInterval = TTL − margin` polls every ~4 minutes per
 * mounted query — a small, deliberate request cost (a handful of catalog
 * endpoints per staff dashboard) accepted in exchange for never rendering a
 * dead link. `refetchIntervalInBackground: false` keeps hidden tabs silent and
 * inherits the provider's outage-noise protection; polling resumes on tab
 * focus, and `refetchOnMount: "always"` covers navigations in between.
 *
 * ⚠️ Sync: if the backend constant changes, update `MEDIA_SIGNED_URL_TTL_MS`
 * here. `test/unit/lib/signed-url-policy.spec.ts` fails when they drift.
 */

import type { QueryObserverOptions } from "@tanstack/react-query"

/**
 * Mirror of the backend's presigned URL expiry —
 * `MEDIA_IMAGE_URL_EXPIRY_SECONDS` in
 * `apps/backend/src/modules/media/media-image-url.helper.ts` (currently 300).
 * Keep both values in sync.
 */
export const MEDIA_SIGNED_URL_TTL_MS = 300_000

/** Head start before backend expiry: refresh one minute early. */
export const MEDIA_URL_REFRESH_MARGIN_MS = 60_000

/**
 * Per-query options for catalog queries whose payloads carry presigned image
 * URLs. Replaces the local `staleTime` only — provider defaults for
 * `gcTime`, `retry`, and `retryDelay` still apply on top.
 *
 * Typed via `satisfies` against TanStack's (partial) option shape —
 * compile-time compatibility with `useQuery` — while keeping the concrete
 * literal type, so spreading it never degrades `useQuery`'s `queryFn`
 * inference. The unit spec additionally asserts every key so none can be
 * silently dropped.
 */
export const signedImageQueryOptions = {
  // Link becomes worthless at TTL; treat data as stale one margin earlier so a
  // stale-driven refetch still lands before expiry.
  staleTime: MEDIA_SIGNED_URL_TTL_MS - MEDIA_URL_REFRESH_MARGIN_MS,
  // Compound queries never refetch on staleness alone — force a fresh signed
  // batch on every mount (returning to the list/detail screen).
  refetchOnMount: "always",
  refetchOnWindowFocus: true,
  // Longest uptime trigger: refresh each link about a minute before it dies.
  // Polling instead of pure staleness is required because the QueryProvider
  // disables mount/focus refetches by default.
  refetchInterval: MEDIA_SIGNED_URL_TTL_MS - MEDIA_URL_REFRESH_MARGIN_MS,
  // Inherit the provider default: no polling in hidden tabs.
  refetchIntervalInBackground: false,
} satisfies Partial<QueryObserverOptions>
