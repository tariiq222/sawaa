import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Single-tenant: rate limits are scoped by IP only.
 */
@Injectable()
export class SingleTenantThrottlerGuard extends ThrottlerGuard {
  // Inherits ThrottlerGuard.getTracker() which returns IP.
}
