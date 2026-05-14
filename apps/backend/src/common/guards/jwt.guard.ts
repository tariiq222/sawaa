import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../../infrastructure/database';
import { RedisService } from '../../infrastructure/cache';
import { TenantContextService } from '../tenant/tenant-context.service';
import { DEFAULT_ORGANIZATION_ID } from '../tenant/tenant.constants';
import { parseUuidHeader } from '../tenant/uuid-header.util';
import { ALLOW_DURING_SUSPENSION_KEY } from './allow-during-suspension.decorator';

export const IS_PUBLIC_KEY = 'isPublic';
const ORG_SUSPENSION_CACHE_TTL_SECONDS = 30;
const ACTIVE_ORG_CACHE_SENTINEL = 'active';

const SUSPENSION_HINT_AR =
  'حسابك معلّق. صاحب الحساب يمكنه تحديث طريقة الدفع لإعادة التفعيل.';
const SUSPENSION_HINT_EN =
  'Your organization is suspended. The owner can update the payment method to reactivate.';

/** Mark a route as public — skips JWT validation. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

interface AuthenticatedReqUser {
  id?: string;
  sub?: string;
  role?: string;
  isSuperAdmin?: boolean;
  scope?: string;
}

/**
 * JWT guard — validates Bearer token on every route by default.
 * Routes decorated with @Public() are exempt.
 *
 * Bug B10: routes decorated with @AllowDuringSuspension() bypass the
 * suspended-org check ONLY when the caller is the OWNER, so suspended
 * tenants can self-serve a payment-method update.
 */
@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly tenantContext: TenantContextService,
  ) {
    super();
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (isPublic) return true;

    const activated = await Promise.resolve(super.canActivate(ctx));
    const req = ctx.switchToHttp().getRequest<{
      user?: AuthenticatedReqUser;
      headers?: Record<string, string | string[] | undefined>;
    }>();

    // TAR-10: Resolve the effective tenant once (honoring super-admin
    // X-Org-Id override) and use it for BOTH the tenant-context stamp
    // AND the suspension check. Otherwise a super-admin overriding into
    // a suspended tenant would silently bypass the ORG_SUSPENDED guard
    // because the suspension check would target their own platform org.
    const effectiveOrgId = this.resolveEffectiveOrgId(req.user, req.headers);
    this.stampTenantContext(req.user, effectiveOrgId);

    const allowDuringSuspension = this.reflector.getAllAndOverride<boolean>(
      ALLOW_DURING_SUSPENSION_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    // Single-tenant: organization suspension check disabled
    // Impersonation sessions removed in single-tenant mode
    return activated as boolean;
  }

  handleRequest<TUser>(
    err: Error | null,
    user: TUser,
    _info: unknown,
    _ctx: ExecutionContext,
  ): TUser {
    if (err || !user) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }

  async assertOrganizationIsActive(): Promise<void> {
    // Single-tenant: no organization suspension
  }

  /**
   * Throws ORG_SUSPENDED unless the route opted into recovery mode AND the
   * caller is OWNER. Anything else (ADMIN, RECEPTIONIST, missing role) on a
   * suspended org is rejected with the bilingual recovery hint.
   */
  private rejectSuspended(): void {
    // Single-tenant: no organization suspension
  }



  /**
   * Resolves the effective tenant org for the current request (TAR-10).
   *
   * Runs after Passport has populated `req.user`, so this is the canonical
   * point to resolve tenant for authenticated requests. The
   * TenantResolverMiddleware now only handles unauthenticated paths
   * (public routes, subdomain binding, auth-bootstrap bypass).
   *
   * Super-admin override: when `user.isSuperAdmin === true` and a
   * well-formed UUID `X-Org-Id` header is present, that org wins over the
   * super-admin's own JWT `organizationId` claim. This is how platform
   * operators inspect / act on a specific tenant. The header is ignored
   * for non-super-admin users (security: never trust caller-supplied org).
   */
  private resolveEffectiveOrgId(
    user: AuthenticatedReqUser | undefined,
    headers: Record<string, string | string[] | undefined> | undefined,
  ): string | undefined {
    if (!user) return undefined;
    return DEFAULT_ORGANIZATION_ID;
  }

  /**
   * Stamps the per-request tenant context using the already-resolved
   * effective org id. Kept as a thin setter so `canActivate` can use the
   * same org for both context-stamping and the suspension check.
   */
  private stampTenantContext(
    user: AuthenticatedReqUser | undefined,
    effectiveOrgId: string | undefined,
  ): void {
    if (!user || !effectiveOrgId) return;

    this.tenantContext.set({
      organizationId: effectiveOrgId,
      id: user.id ?? user.sub ?? '',
      role: user.role ?? '',
      isSuperAdmin: user.isSuperAdmin === true,
    });
  }
}
