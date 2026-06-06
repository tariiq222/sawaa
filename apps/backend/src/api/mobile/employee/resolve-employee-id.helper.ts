import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { JwtUser } from '../../../common/auth/current-user.decorator';

/**
 * Resolves the Employee.id for the authenticated user.
 *
 * Booking.employeeId / Invoice.employeeId reference Employee.id — NOT User.id.
 * The JWT carries User.id as `user.sub`, so any query keyed on the employee
 * must first translate `user.sub` (or the optional `user.employeeId` claim)
 * into the actual Employee.id, or every query silently returns zero rows.
 *
 * @throws ForbiddenException('employee_profile_not_found') if the user has no active employee profile.
 */
export async function resolveEmployeeId(
  prisma: PrismaService,
  user: JwtUser,
): Promise<string> {
  if (user.employeeId) {
    return user.employeeId;
  }

  const employee = await prisma.employee.findFirst({
    where: { userId: user.sub, isActive: true },
    select: { id: true },
  });

  if (!employee) {
    throw new ForbiddenException('employee_profile_not_found');
  }

  return employee.id;
}
