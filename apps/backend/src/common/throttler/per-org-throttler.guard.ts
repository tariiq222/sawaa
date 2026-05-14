import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * Throttler that scopes the rate-limit bucket by (IP, organizationId) instead
 * of just IP. Without this, a malicious tenant can exhaust the global IP
 * budget for shared infrastructure (NAT, mobile carriers) and DoS other
 * tenants behind the same egress IP.
 *
 * The default IP-only throttler is still applied — this is an additional
 * named layer ('per-org') that activates once a request has resolved a tenant.
 * Pre-auth / unresolved requests fall back to ip:no-tenant.
 *
 * Note: TenantAwareThrottlerGuard (registered first) already scopes the
 * unnamed default throttler by (IP, orgId). This guard applies the same
 * scoping strategy to the named 'per-org' throttler with a wider per-org
 * limit, reflecting that users behind the same egress IP are independent
 * tenants and should not compete for one another's quota.
 */
@Injectable()
export class PerOrgThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const r = req as unknown as Request & { user?: { organizationId?: string } };
    const ip = r.ip ?? 'unknown';
    const orgId = r.user?.organizationId ?? 'no-tenant';
    return `${ip}:${orgId}`;
  }
}
