import { Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';
import { BUILT_IN } from './built-in-rules';

export type AppAbility = MongoAbility;

/**
 * Input shape for `buildForUser`.
 *
 * `role` is the canonical `User.role` field in single-tenant mode.
 * It is propagated from the JWT `role` claim onto `req.user` by `JwtStrategy`.
 *
 * `systemRolePermissions` — when present, overrides the BUILT_IN hardcoded rules
 * for the user's built-in role, allowing DB-stored permissions to take effect.
 * Only used for non-SUPER_ADMIN, non-CLIENT roles.
 */
export interface AbilitySubjectUser {
  role?: string | null;
  customRole: { permissions: Array<{ action: string; subject: string }> } | null;
  systemRolePermissions?: Array<{ action: string; subject: string }> | null;
}

@Injectable()
export class CaslAbilityFactory {
  /**
   * Build an ability directly from a pre-computed flat permissions list.
   *
   * This is the fast path used by `CaslGuard` when `req.user.permissions` is
   * already populated by `JwtStrategy` (which fetches system-role permissions
   * from the DB and calls `buildForUser` with the full picture, then flattens
   * the resulting CASL rules onto `req.user.permissions`).
   *
   * NOTE: We intentionally do NOT re-apply the `isWildcard` filter here.
   * The input comes from a server-side verified JWT token; the permissions were
   * already computed by `buildForUser` inside `JwtStrategy.validate()`, which
   * already strips wildcards for customRole/systemRole sources and only allows
   * `manage:all` for SUPER_ADMIN.  A SUPER_ADMIN legitimately carries
   * `[{ action: "manage", subject: "all" }]` in `req.user.permissions`, and
   * that must pass through unchanged so SUPER_ADMIN can access everything.
   * Re-filtering here would break SUPER_ADMIN access.
   */
  buildFromPermissions(perms: Array<{ action: string; subject: string }>): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    for (const p of perms) {
      can(p.action, p.subject);
    }
    return build();
  }

  buildForUser(user: AbilitySubjectUser): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    // SECURITY (P0-3): defense-in-depth — refuse the wildcard `manage:all`
    // CASL pair from customRole/systemRole sources. Only the built-in SUPER_ADMIN row
    // (gated separately by User.isSuperAdmin) may hold that pair. Filtering
    // here closes the door if AssignPermissionsDto validation is ever bypassed.
    const isWildcard = (action: unknown, subject: unknown): boolean => {
      const a = String(action).toLowerCase();
      const s = String(subject).toLowerCase();
      return (a === 'manage' && s === 'all') || s === 'all';
    };

    if (user.customRole) {
      for (const p of user.customRole.permissions) {
        if (isWildcard(p.action, p.subject)) continue;
        can(p.action, p.subject);
      }
    }

    const effectiveRole = user.role ?? '';

    if (effectiveRole === 'SUPER_ADMIN') {
      // SUPER_ADMIN always gets manage:all from code — never from DB
      can('manage', 'all');
    } else if (user.systemRolePermissions && user.systemRolePermissions.length > 0) {
      // System role permissions from DB override the hardcoded BUILT_IN map
      for (const p of user.systemRolePermissions) {
        if (isWildcard(p.action, p.subject)) continue;
        can(p.action, p.subject);
      }
    } else {
      // Fallback: use hardcoded BUILT_IN rules (before bootstrap runs or for CLIENT)
      for (const rule of BUILT_IN[effectiveRole] ?? []) {
        const actions = Array.isArray(rule.action) ? rule.action : [rule.action];
        for (const action of actions) {
          can(action, rule.subject as string);
        }
      }
    }

    return build();
  }
}
