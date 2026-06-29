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
 * result straight into `flattenPermissions({ role, customRole, systemRolePermissions })`.
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

  return sysRole?.permissions ?? null;
}
