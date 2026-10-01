import type { Prisma } from '@prisma/client';
import type { PlatformSettingsService } from '../../platform/settings/platform-settings.service';

type EmployeeReader = { employee: Pick<Prisma.TransactionClient['employee'], 'findFirst'> };

/**
 * Mobile OTP is a single factor and the app's staff side is the practitioner
 * interface. Staff may hold a mobile session only when linked to an active
 * Employee, and super-admins never while dashboard two-factor is required.
 */
export async function isMobileStaffEligible(
  db: EmployeeReader,
  settings: Pick<PlatformSettingsService, 'get'>,
  user: { id: string; isSuperAdmin?: boolean | null },
): Promise<boolean> {
  const practitioner = await db.employee.findFirst({ where: { userId: user.id, isActive: true }, select: { id: true } });
  if (!practitioner) return false;
  if (user.isSuperAdmin === true && (await settings.get<boolean>('security.twoFactor.required')) === true) return false;
  return true;
}
