import { UserRole } from '@prisma/client';
import type { PrismaService } from '../../../infrastructure/database';

/**
 * Loads the DB-stored permissions for a user's built-in system role
 * (`CustomRole.systemKey === role`).
 *
 * P1-8: the dashboard permission list returned by login / `me` / dashboard-OTP
 * must reflect DB system-role edits exactly the way `JwtStrategy.validate()`
 * already feeds them into CASL. Without this, the UI (which reads the returned
 * `permissions[]`) drifts from enforcement (which builds CASL from the
 * strategy's `systemRolePermissions`), producing dead buttons or
 * hidden-but-allowed features.
 *
 * Returns `null` for SUPER_ADMIN (manage:all comes from code, never DB) and for
 * CLIENT (no dashboard surface) — matching the strategy's gate. Callers pass the
 * result straight into `flattenPermissions({ role, customRole, systemRolePermissions })`
 * (which then forwards it to `CaslAbilityFactory.buildForUser`). The factory
 * treats a non-null array as an explicit override (empty array = deny-all) and
 * `null` as "fall back to the BUILT_IN hardcoded rules".
 *
 * RX-PERMS-EMPTY: a zero-row role whose `permissionsCustomized` flag is `false`
 * is indistinguishable from a failed seed and must NOT be treated as an
 * explicit deny-all grant. Returning `null` here causes `buildForUser` to fall
 * back to the hardcoded `BUILT_IN` map, restoring built-in grants until the
 * next bootstrap run repairs the row. A zero-row role whose flag IS `true`
 * remains `[]` (the admin intentionally emptied it; bootstrap will auto-heal
 * that state on the next boot by resyncing from BUILT_IN and clearing the
 * flag).
 */
export async function loadSystemRolePermissions(
  prisma: PrismaService,
  role: string | null | undefined,
): Promise<Array<{ action: string; subject: string }> | null> {
  if (!role || role === 'SUPER_ADMIN' || role === 'CLIENT') {
    return null;
  }

  const sysRole = await prisma.customRole.findFirst({
    where: { systemKey: role as UserRole },
    select: { permissions: { select: { action: true, subject: true } } },
  });

  // No DB row → BUILT_IN fallback (before bootstrap, or for an unknown role).
  if (!sysRole) return null;

  // Common path: non-empty DB list (customized or not) — the factory will
  // honor it. Customized non-empty rows still take effect.
  if (sysRole.permissions.length > 0) return sysRole.permissions;

  // Edge case (RX-PERMS-EMPTY): zero rows. We must distinguish
  //   a) customized + empty → [] (explicit deny-all, bootstrap will heal),
  //   b) uncustomized + empty → null (BUILT_IN fallback — failed seed).
  // The first query above does not select the `permissionsCustomized` flag,
  // so a second lookup is needed ONLY for this empty-row edge case.
  const customizedRow = await prisma.customRole.findFirst({
    where: { systemKey: role as UserRole },
    select: { permissionsCustomized: true },
  });

  return customizedRow?.permissionsCustomized === true ? [] : null;
}
