import { SetMetadata } from '@nestjs/common';

/**
 * Bug B10 — Suspended-organization recovery.
 *
 * `JwtGuard.assertOrganizationIsActive()` rejects every authenticated request
 * for a suspended Organization. That blocks the OWNER from updating their
 * payment method to lift the suspension, so they have no self-serve recovery
 * path and must email super-admin support.
 *
 * Endpoints decorated with `@AllowDuringSuspension()` are exempt from that
 * check — but ONLY for callers whose `membershipRole === 'OWNER'`. Other
 * roles (ADMIN, RECEPTIONIST, …) on a suspended org still 401/403.
 *
 * USE NARROWLY. The recovery surface is intentionally tiny:
 *   - GET  /dashboard/billing/subscription           (read current state)
 *   - GET  /dashboard/billing/saved-cards            (list payment methods)
 *   - POST /dashboard/billing/saved-cards            (add a new card)
 *   - PATCH /dashboard/billing/saved-cards/:id/set-default
 *   - POST /dashboard/billing/subscription/retry-payment
 *   - GET  /auth/me                                   (basic identity)
 *   - POST /auth/logout                               (leave session)
 *
 * Do NOT decorate plan-change endpoints (upgrade-plan, downgrade-plan,
 * cancel-subscription). Fixing payment is the only path forward; the OWNER
 * shouldn't be hopping plans while their org is suspended.
 *
 * Do NOT decorate dashboard data endpoints (clients, bookings, etc.) — that
 * would defeat the suspension entirely.
 */
export const ALLOW_DURING_SUSPENSION_KEY = 'allowDuringSuspension';

export const AllowDuringSuspension = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOW_DURING_SUSPENSION_KEY, true);
