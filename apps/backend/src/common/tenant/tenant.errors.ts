import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { TENANT_ERROR_CODES } from './tenant.constants';

export class TenantResolutionError extends BadRequestException {
  constructor(reason: string) {
    super({ code: TENANT_ERROR_CODES.RESOLUTION_FAILED, message: reason });
  }
}

/**
 * Thrown by TenantContextService.requireOrganizationId() when strict mode is
 * active and no CLS tenant context is present. This signals a fail-closed
 * situation — a handler somewhere tried to read/write scoped data without
 * first going through the tenant resolver.
 *
 * Treat a 401 with this code in prod logs as a bug, not a permission failure.
 */
export class UnauthorizedTenantAccessError extends UnauthorizedException {
  constructor(reason = 'Tenant context not set — no organizationId available') {
    super({ code: TENANT_ERROR_CODES.RESOLUTION_FAILED, message: reason });
  }
}

export class CrossTenantAccessError extends ForbiddenException {
  constructor(resource: string, expectedOrgId: string, actualOrgId: string) {
    super({
      code: TENANT_ERROR_CODES.CROSS_TENANT_ACCESS,
      message: `Cross-tenant access attempt on ${resource}`,
      expectedOrgId,
      actualOrgId,
    });
  }
}

export class OrganizationSuspendedError extends ForbiddenException {
  constructor(organizationId: string) {
    super({
      code: TENANT_ERROR_CODES.ORG_SUSPENDED,
      message: 'Organization is suspended',
      organizationId,
    });
  }
}
