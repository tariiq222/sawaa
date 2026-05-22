import { Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';
import type {
  PermissionSubject,
  PermissionAction,
} from '@sawaa/shared/constants';

export type AppAbility = MongoAbility;

/**
 * Built-in role → permission-rule map.
 *
 * Subjects come from `@sawaa/shared/constants` (`PERMISSION_SUBJECTS`).
 * Actions come from `@sawaa/shared/constants` (`PERMISSION_ACTIONS`),
 * with the additional CASL-only literal `'all'` reserved for SUPER_ADMIN.
 *
 * OWNER is the top-level role. It carries everything ADMIN does.
 * ADMIN handles day-to-day clinic ops.
 *
 * Super-admin platform access is gated by `User.isSuperAdmin` (boolean),
 * NOT by this map. The `SUPER_ADMIN` row here is a transitional fallback
 * for in-flight tokens that still carry the legacy `role` claim.
 */
type Rule = {
  action: PermissionAction | 'manage' | Array<PermissionAction | 'manage'>;
  subject: PermissionSubject | 'all';
};

const ADMIN_RULES: readonly Rule[] = [
  { action: 'manage', subject: 'User' },
  { action: 'manage', subject: 'Role' },
  { action: 'manage', subject: 'Booking' },
  { action: 'manage', subject: 'Client' },
  { action: 'manage', subject: 'Employee' },
  { action: 'manage', subject: 'Invoice' },
  { action: 'manage', subject: 'Payment' },
  { action: 'manage', subject: 'Report' },
  { action: 'manage', subject: 'Setting' },
  { action: 'manage', subject: 'Department' },
  { action: 'manage', subject: 'Category' },
  { action: 'manage', subject: 'Service' },
  { action: 'manage', subject: 'Branch' },
  { action: 'manage', subject: 'Branding' },
  { action: 'manage', subject: 'Content' },
  { action: 'manage', subject: 'Integration' },
  { action: 'manage', subject: 'Coupon' },
];

const BUILT_IN: Record<string, readonly Rule[]> = {
  SUPER_ADMIN: [{ action: 'manage', subject: 'all' }],
  // OWNER inherits everything ADMIN can do. OWNER is typically the founder /
  // financial decision maker; ADMIN is the day-to-day operations lead.
  OWNER: [
    ...ADMIN_RULES,
  ],
  ADMIN: ADMIN_RULES,
  RECEPTIONIST: [
    { action: ['create', 'read', 'update'], subject: 'Booking' },
    { action: ['create', 'read', 'update'], subject: 'Client' },
    { action: 'read', subject: 'Employee' },
    { action: 'read', subject: 'Invoice' },
    { action: 'read', subject: 'Service' },
    { action: 'read', subject: 'Category' },
  ],
  ACCOUNTANT: [
    { action: 'manage', subject: 'Invoice' },
    { action: 'manage', subject: 'Payment' },
    { action: 'read', subject: 'Booking' },
    { action: 'read', subject: 'Report' },
  ],
  EMPLOYEE: [
    { action: 'read', subject: 'Booking' },
    { action: 'read', subject: 'Client' },
    { action: 'update', subject: 'Booking' },
  ],
  CLIENT: [
    { action: 'read', subject: 'Booking' },
    { action: 'create', subject: 'Booking' },
    { action: 'read', subject: 'Invoice' },
  ],
};

/**
 * Input shape for `buildForUser`.
 *
 * `role` is the canonical `User.role` field in single-tenant mode.
 * It is propagated from the JWT `role` claim onto `req.user` by `JwtStrategy`.
 */
export interface AbilitySubjectUser {
  role?: string | null;
  customRole: { permissions: Array<{ action: string; subject: string }> } | null;
}

@Injectable()
export class CaslAbilityFactory {
  buildForUser(user: AbilitySubjectUser): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    // SECURITY (P0-3): defense-in-depth — refuse the wildcard `manage:all`
    // CASL pair from customRole sources. Only the built-in SUPER_ADMIN row
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
    for (const p of BUILT_IN[effectiveRole] ?? []) can(p.action, p.subject);
    return build();
  }
}
