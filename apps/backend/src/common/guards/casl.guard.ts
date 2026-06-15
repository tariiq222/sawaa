import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityFactory } from '../../modules/identity/casl/casl-ability.factory';

type Action = 'manage' | 'create' | 'read' | 'update' | 'delete';
type Subject = string;

export interface RequiredPermission {
  action: Action;
  subject: Subject;
}

export const CHECK_PERMISSIONS_KEY = 'requiredPermissions';

/** Declare permissions required to access a route. */
export const CheckPermissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(CHECK_PERMISSIONS_KEY, permissions);



type RequestUser = {
  /** User role — canonical single-tenant role from `User.role`. */
  role?: string | null;
  customRole: { permissions: Array<{ action: string; subject: string }> } | null;
  /**
   * Pre-computed, flattened permission list set by `JwtStrategy.validate()`.
   *
   * When present this is the **source of truth** for access control: it was
   * derived from DB-stored system-role permissions (or BUILT_IN fallback) at
   * token-validation time and reflects any DB edits made to built-in roles.
   *
   * When absent (e.g., a strategy that does not populate this field) the guard
   * falls back to `buildForUser(user)` so existing strategies continue to work.
   */
  permissions?: Array<{ action: string; subject: string }>;
};

/**
 * CASL guard — evaluates @CheckPermissions() metadata against the
 * current user's ability.
 *
 * **Primary path:** if `req.user.permissions` is populated (set by
 * `JwtStrategy`), the ability is built directly from that pre-computed list via
 * `buildFromPermissions()`.  This ensures that any DB edits to built-in role
 * permissions take effect immediately — the guard never falls back to the
 * hardcoded BUILT_IN map when `req.user.permissions` is present.
 *
 * **Fallback path:** if `req.user.permissions` is absent or empty, the guard
 * derives the ability via `buildForUser(user)` (hardcoded BUILT_IN rules) so
 * that strategies which do not set `permissions` still work correctly.
 *
 * Must run after JwtGuard so req.user is populated.
 */
@Injectable()
export class CaslGuard implements CanActivate {
  private readonly abilityFactory = new CaslAbilityFactory();

  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RequiredPermission[]>(
      CHECK_PERMISSIONS_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    if (!required || required.length === 0) return true;

    const { user } = ctx
      .switchToHttp()
      .getRequest<{ user?: RequestUser }>();

    if (!user) throw new ForbiddenException('No authenticated user');

    // Primary path: use the pre-computed permissions from JWT validation (DB is
    // the authority).  Fallback: derive from role/customRole for strategies that
    // do not populate req.user.permissions.
    const ability =
      Array.isArray(user.permissions) && user.permissions.length > 0
        ? this.abilityFactory.buildFromPermissions(user.permissions)
        : this.abilityFactory.buildForUser(user);

    const allowed = required.every((p) => ability.can(p.action, p.subject));

    if (!allowed) throw new ForbiddenException('Insufficient permissions');

    return true;
  }
}
