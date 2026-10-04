import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CancellationReason } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { BookingCancelRequestedEvent } from '../events/booking-cancel-requested.event';
import { assertTransition } from '../booking-state-machine';
import { assertBookingIsMutable, updateBookingAtomically } from '../booking-lifecycle.helper';

export interface RequestCancelBookingCommand {
  bookingId: string;
  reason: CancellationReason;
  cancelNotes?: string;
  requestedBy: string;
}

@Injectable()
export class RequestCancelBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(cmd: RequestCancelBookingCommand) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: cmd.bookingId },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }
    assertBookingIsMutable(booking);

    const nextStatus = assertTransition(booking.status, 'CLIENT_REQUEST_CANCEL');

    const [updated] = await this.rlsTransaction.withTransaction((tx) => Promise.all([
      updateBookingAtomically(tx, {
        bookingId: cmd.bookingId,
        currentStatus: booking.status,
        actionLabel: 'cancel requested',
        data: {
          status: nextStatus,
          cancelReason: cmd.reason,
          cancelNotes: cmd.cancelNotes,
        },
      }),
      tx.bookingStatusLog.create({
        data: {
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: nextStatus,
          changedBy: cmd.requestedBy,
          reason: cmd.reason,
        },
      }),
    ]));

    const event = new BookingCancelRequestedEvent({
      bookingId: booking.id,
      clientId: booking.clientId,
      employeeId: booking.employeeId,
      reason: cmd.reason,
      cancelNotes: cmd.cancelNotes,
    });
    // P1: nothing subscribes to bookings.booking.cancel_requested today, while
    // strict publish() throws NoEventConsumersRegisteredError for an unhandled
    // event name. That throw happens AFTER the CANCEL_REQUESTED commit, so an
    // employee request that succeeded was reported as an HTTP 500, and the
    // retry failed against the new status (CLIENT_REQUEST_CANCEL does not
    // accept CANCEL_REQUESTED as a source state).
    //
    // The event stays observational until a consumer is registered — mirrors
    // reject-cancel-booking. Restore strict publish() when a real consumer
    // exists, and stage it in the transactional outbox if it becomes required.
    await this.eventBus.publishOptional(event.eventName, event.toEnvelope());

    return updated;
  }
}
