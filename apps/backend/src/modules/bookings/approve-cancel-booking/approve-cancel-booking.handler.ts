import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { BookingCancelApprovedEvent } from '../events/booking-cancel-approved.event';
import { assertTransition } from '../booking-state-machine';
import { GroupSessionCapacityService } from '../group-session/group-session-capacity.service';

export interface ApproveCancelBookingCommand {
  bookingId: string;
  approvedBy: string;
  approverNotes?: string;
}

@Injectable()
export class ApproveCancelBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly eventBus: EventBusService,
    private readonly settingsHandler: GetBookingSettingsHandler,
    private readonly groupSessionCapacity: GroupSessionCapacityService,
  ) {}

  async execute(cmd: ApproveCancelBookingCommand) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: cmd.bookingId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    const nextStatus = assertTransition(booking.status, 'APPROVE_CANCEL');

    const settings = await this.settingsHandler.execute({
      branchId: booking.branchId,
    });

    const autoRefund =
      'autoRefundOnCancel' in settings
        ? (settings as Record<string, unknown>).autoRefundOnCancel === true
        : true;

    const [updated] = await this.rlsTransaction.withTransaction(async (tx) => {
      const results = await Promise.all([
        tx.booking.update({
          where: { id: cmd.bookingId },
          data: {
            status: nextStatus,
            cancelledAt: new Date(),
          },
        }),
        tx.bookingStatusLog.create({
          data: {
            bookingId: cmd.bookingId,
            fromStatus: booking.status,
            toStatus: nextStatus,
            changedBy: cmd.approvedBy,
            reason: cmd.approverNotes ?? 'Cancel request approved',
          },
        }),
      ]);
      // Roll back sibling AWAITING_PAYMENT bookings for group sessions.
      if (booking.groupSessionId) {
        await this.groupSessionCapacity.recalculateGroupStatus(tx, booking.groupSessionId);
      }
      return results;
    });

    const event = new BookingCancelApprovedEvent({
      bookingId: booking.id,
      clientId: booking.clientId,
      employeeId: booking.employeeId,
      autoRefund,
      approverNotes: cmd.approverNotes,
    });
    await this.eventBus.publish(event.eventName, event.toEnvelope());

    return { ...updated, autoRefund };
  }
}
