import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database';

export interface BookingReadRequester {
  requesterRole?: string | null;
  requesterUserId?: string;
}

export async function assertBookingReadAccess(
  prisma: Pick<PrismaService, 'employee'>,
  booking: { employeeId: string | null },
  requester: BookingReadRequester,
): Promise<void> {
  if (requester.requesterRole !== 'EMPLOYEE') return;
  if (!requester.requesterUserId) throw new ForbiddenException('Employee identity is required');
  const employee = await prisma.employee.findFirst({
    where: { userId: requester.requesterUserId },
    select: { id: true },
  });
  if (!employee || employee.id !== booking.employeeId) {
    throw new ForbiddenException('Booking is not assigned to you');
  }
}
