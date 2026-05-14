import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';

export interface DeleteClientCommand {
  clientId: string;
}

@Injectable()
export class DeleteClientHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: DeleteClientCommand) {
    const client = await this.prisma.client.findFirst({
      where: { id: cmd.clientId, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Client not found');

    // ─── Cross-BC integrity guards ───────────────────────────────────────────
    // Booking (people → bookings): block if any active appointment exists
    const activeBookings = await this.prisma.booking.count({
      where: {
        clientId: cmd.clientId,
        status: { in: ['PENDING', 'PENDING_GROUP_FILL', 'AWAITING_PAYMENT', 'CONFIRMED', 'CANCEL_REQUESTED'] },
      },
    });
    if (activeBookings > 0) {
      throw new ConflictException(
        `Cannot delete client with ${activeBookings} active booking(s). Cancel or complete them first.`,
      );
    }

    // Invoice (people → finance): block if unpaid invoices exist
    const unpaidInvoices = await this.prisma.invoice.count({
      where: {
        clientId: cmd.clientId,
        status: { in: ['DRAFT', 'ISSUED', 'PARTIALLY_PAID'] },
      },
    });
    if (unpaidInvoices > 0) {
      throw new ConflictException(
        `Cannot delete client with ${unpaidInvoices} unpaid invoice(s). Settle them first.`,
      );
    }

    // GroupEnrollment (people → bookings)
    const activeEnrollments = await this.prisma.groupEnrollment.count({
      where: {
        clientId: cmd.clientId,
        booking: { status: { in: ['PENDING', 'PENDING_GROUP_FILL', 'AWAITING_PAYMENT', 'CONFIRMED', 'CANCEL_REQUESTED'] } },
      },
    });
    if (activeEnrollments > 0) {
      throw new ConflictException(
        `Cannot delete client with ${activeEnrollments} active group enrollment(s). Cancel them first.`,
      );
    }

    // Waitlist (people → bookings)
    const waitlistEntries = await this.prisma.waitlistEntry.count({
      where: { clientId: cmd.clientId, status: 'WAITING' },
    });
    if (waitlistEntries > 0) {
      throw new ConflictException(
        `Cannot delete client with ${waitlistEntries} waitlist entry(ies). Remove them first.`,
      );
    }

    // Rating (people → organization)
    const ratings = await this.prisma.rating.count({
      where: { clientId: cmd.clientId },
    });
    if (ratings > 0) {
      throw new ConflictException(
        `Cannot delete client with ${ratings} rating(s). Ratings must be preserved for audit.`,
      );
    }

    // Soft delete: set deletedAt, force inactive, and null the phone so the
    // unique phone constraint no longer blocks re-creating a client with the same
    // number. The original phone is preserved in notes for audit.
    await this.prisma.client.update({
      where: { id: cmd.clientId },
      data: {
        deletedAt: new Date(),
        isActive: false,
        phone: null,
        notes: client.phone ? `${client.notes ?? ''}\n[deleted-phone:${client.phone}]`.trim() : client.notes,
      },
    });
  }
}
