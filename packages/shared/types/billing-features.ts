/**
 * Billing Features Types — @deqah/shared
 *
 * Shared types for the billing features endpoint
 * `GET /dashboard/billing/my-features`.
 *
 * @see apps/backend/src/modules/platform/billing/get-my-features/get-my-features.dto.ts
 * @see apps/dashboard/hooks/use-billing-features.ts
 */

// Mirrors Prisma enum SubscriptionStatus — kept in sync manually so this package has no @prisma/client dep
export type SubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'SUSPENDED'
  | 'CANCELED';

/**
 * A single feature entry in the billing features response.
 * Quantitative features include `limit` and `currentCount`.
 */
export interface FeatureEntry {
  /** Whether the feature is enabled for this organization. */
  enabled: boolean;

  /**
   * Plan limit for quantitative features.
   * Use `-1` to represent "unlimited".
   * Omitted for on/off (boolean) features.
   */
  limit?: number;

  /**
   * Current usage count.
   * Present only when `limit` is present (quantitative features).
   */
  currentCount?: number;
}

/**
 * Full billing features response returned by `GET /dashboard/billing/my-features`.
 *
 * @example
 * ```json
 * {
 *   "planSlug": "PRO",
 *   "status": "ACTIVE",
 *   "features": {
 *     "recurring_bookings": { "enabled": true },
 *     "branches": { "enabled": true, "limit": 3, "currentCount": 1 }
 *   }
 * }
 * ```
 */
export interface BillingFeaturesResponse {
  planSlug: string;
  status: SubscriptionStatus;
  features: Record<string, FeatureEntry>;
}
