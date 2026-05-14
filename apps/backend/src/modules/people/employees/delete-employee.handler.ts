import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface DeleteEmployeeCommand { employeeId: string; }

@Injectable()
export class DeleteEmployeeHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: DeleteEmployeeCommand): Promise<void> {
    const employee = await this.prisma.employee.findFirst({
      where: { id: cmd.employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    // ─── Cross-BC integrity guards ───────────────────────────────────────────
    // Booking (people → bookings): block if any active appointment exists
    const activeBookings = await this.prisma.booking.count({
      where: {
        employeeId: cmd.employeeId,
        status: { in: ['PENDING', 'PENDING_GROUP_FILL', 'AWAITING_PAYMENT', 'CONFIRMED', 'CANCEL_REQUESTED'] },
      },
    });
    if (activeBookings > 0) {
      throw new ConflictException(
        `Cannot delete employee with ${activeBookings} active booking(s). Cancel or complete them first.`,
      );
    }

    // GroupSession (people → bookings): block if hosting upcoming sessions
    const activeGroupSessions = await this.prisma.groupSession.count({
      where: {
        employeeId: cmd.employeeId,
        status: { in: ['OPEN', 'FULL'] },
      },
    });
    if (activeGroupSessions > 0) {
      throw new ConflictException(
        `Cannot delete employee hosting ${activeGroupSessions} upcoming group session(s). Cancel them first.`,
      );
    }

    // Invoice (people → finance): block if unpaid invoices exist
    const unpaidInvoices = await this.prisma.invoice.count({
      where: {
        employeeId: cmd.employeeId,
        status: { in: ['DRAFT', 'ISSUED', 'PARTIALLY_PAID'] },
      },
    });
    if (unpaidInvoices > 0) {
      throw new ConflictException(
        `Cannot delete employee with ${unpaidInvoices} unpaid invoice(s). Settle them first.`,
      );
    }

    // Waitlist (people → bookings)
    const waitlistEntries = await this.prisma.waitlistEntry.count({
      where: { employeeId: cmd.employeeId, status: 'WAITING' },
    });
    if (waitlistEntries > 0) {
      throw new ConflictException(
        `Cannot delete employee with ${waitlistEntries} waitlist entry(ies). Remove them first.`,
      );
    }

    // Rating (people → organization)
    const ratings = await this.prisma.rating.count({
      where: { employeeId: cmd.employeeId },
    });
    if (ratings > 0) {
      throw new ConflictException(
        `Cannot delete employee with ${ratings} rating(s). Ratings must be preserved for audit.`,
      );
    }

    await this.prisma.employee.delete({ where: { id: cmd.employeeId } });
  }
}
