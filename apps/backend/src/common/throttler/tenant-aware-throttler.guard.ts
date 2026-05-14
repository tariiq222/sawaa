import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Single-tenant: rate limits are scoped by IP only.
 *
 * In the original multi-tenant design this guard tracked (IP, orgId) pairs
 * to prevent one tenant from starving others behind a shared NAT. In
 * single-tenant mode there is exactly one organization, so the orgId
 * segment is always the same constant and adds no isolation value.
 *
 * Keeping the class name avoids a cascade rename across all import sites.
 */
@Injectable()
export class TenantAwareThrottlerGuard extends ThrottlerGuard {
  // Inherits ThrottlerGuard.getTracker() which returns IP — no override needed.
}
