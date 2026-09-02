import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface AssertEmployeeBookingOwnershipCommand {
  bookingId: string;
  employeeId: string;
}

@Injectable()
export class AssertEmployeeBookingOwnershipHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: AssertEmployeeBookingOwnershipCommand): Promise<void> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: command.bookingId },
      select: { id: true, employeeId: true },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${command.bookingId} not found`);
    }
    if (booking.employeeId !== command.employeeId) {
      throw new ForbiddenException('Booking is not assigned to you');
    }
  }
}
