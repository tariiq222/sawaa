import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../infrastructure/database';
import { RedisService } from '../../infrastructure/cache';
import { DEFAULT_ORG_ID, TENANT_CLS_KEY } from '../constants';

export const IS_PUBLIC_KEY = 'isPublic';

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
    private readonly cls: ClsService,
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

    const effectiveOrgId = this.resolveEffectiveOrgId(req.user, req.headers);
    this.stampTenantContext(req.user, effectiveOrgId);

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

  /**
   * Resolves the effective org for the current request.
   * Single-tenant: always returns DEFAULT_ORG_ID.
   */
  private resolveEffectiveOrgId(
    user: AuthenticatedReqUser | undefined,
    _headers: Record<string, string | string[] | undefined> | undefined,
  ): string | undefined {
    if (!user) return undefined;
    return DEFAULT_ORG_ID;
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

    this.cls.set(TENANT_CLS_KEY, {
      organizationId: effectiveOrgId,
      id: user.id ?? user.sub ?? '',
      role: user.role ?? '',
      isSuperAdmin: user.isSuperAdmin === true,
    });
  }
}
