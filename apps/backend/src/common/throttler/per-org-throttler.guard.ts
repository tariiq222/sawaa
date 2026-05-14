import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Single-tenant: rate limits are scoped by IP only.
 *
 * In the original multi-tenant design this guard applied an additional
 * named 'per-org' throttler layer scoped by (IP, orgId). In single-tenant
 * mode the orgId is always the same constant, so the bucket degenerates to
 * per-IP. Keeping the class name avoids a cascade rename across all import
 * sites.
 */
@Injectable()
export class PerOrgThrottlerGuard extends ThrottlerGuard {
  // Inherits ThrottlerGuard.getTracker() which returns IP — no override needed.
}
