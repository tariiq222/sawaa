import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { BookingCancelRejectedEvent } from '../events/booking-cancel-rejected.event';
import { assertTransition } from '../booking-state-machine';
import { updateBookingAtomically } from '../booking-lifecycle.helper';

export interface RejectCancelBookingCommand {
  bookingId: string;
  rejectedBy: string;
  rejectReason: string;
}

@Injectable()
export class RejectCancelBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(cmd: RejectCancelBookingCommand) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: cmd.bookingId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    const nextStatus = assertTransition(booking.status, 'REJECT_CANCEL');

    const [updated] = await this.rlsTransaction.withTransaction((tx) => Promise.all([
      updateBookingAtomically(tx, {
        bookingId: cmd.bookingId,
        currentStatus: booking.status,
        actionLabel: 'cancel rejection applied',
        data: {
          status: nextStatus,
          cancelReason: null,
          cancelNotes: null,
        },
      }),
      tx.bookingStatusLog.create({
        data: {
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: nextStatus,
          changedBy: cmd.rejectedBy,
          reason: cmd.rejectReason,
        },
      }),
    ]));

    const event = new BookingCancelRejectedEvent({
      bookingId: booking.id,
      clientId: booking.clientId,
      employeeId: booking.employeeId,
      rejectReason: cmd.rejectReason,
    });
    await this.eventBus.publish(event.eventName, event.toEnvelope());

    return updated;
  }
}
