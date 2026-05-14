import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  CaslAbilityFactory,
  AppAbility,
} from '../../modules/identity/casl/casl-ability.factory';

export type Action = 'manage' | 'create' | 'read' | 'update' | 'delete';
export type Subject = string;

export interface RequiredPermission {
  action: Action;
  subject: Subject;
}

export const CHECK_PERMISSIONS_KEY = 'requiredPermissions';

/** Declare permissions required to access a route. */
export const CheckPermissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(CHECK_PERMISSIONS_KEY, permissions);

export type { AppAbility };

type RequestUser = {
  /** Per-org role from `Membership.role` — populated by `JwtStrategy` from the JWT claim. */
  membershipRole?: string | null;
  /** @deprecated legacy global role; consulted only when membershipRole is absent. */
  role?: string | null;
  customRole: { permissions: Array<{ action: string; subject: string }> } | null;
};

/**
 * CASL guard — evaluates @CheckPermissions() metadata against the
 * current user's ability, derived from their role (built-in) or customRole.
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

    const ability = this.abilityFactory.buildForUser(user);

    const allowed = required.every((p) => ability.can(p.action, p.subject));

    if (!allowed) throw new ForbiddenException('Insufficient permissions');

    return true;
  }
}
