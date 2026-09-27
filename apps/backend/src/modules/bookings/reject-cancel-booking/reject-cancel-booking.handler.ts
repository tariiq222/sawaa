import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { BookingCancelRejectedEvent } from '../events/booking-cancel-rejected.event';
import { assertTransition } from '../booking-state-machine';
import { isUnconfirmedHoldStatus, nextHoldExpiry } from '../booking-hold-window';
import { assertBookingIsMutable, updateBookingAtomically } from '../booking-lifecycle.helper';

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
    assertBookingIsMutable(booking);

    // Restore the booking to the status it held BEFORE the client requested
    // cancellation, read from the matching status-log row. Without this the
    // booking would fall back to the safe PENDING default and an originally
    // CONFIRMED/AWAITING_PAYMENT booking would lose its prior state.
    const requestLog = await this.prisma.bookingStatusLog.findFirst({
      where: { bookingId: cmd.bookingId, toStatus: booking.status },
      orderBy: { createdAt: 'desc' },
    });
    const restoreTo = requestLog?.fromStatus ?? null;
    const nextStatus = assertTransition(booking.status, 'REJECT_CANCEL', restoreTo);

    // An unconfirmed booking restored from CANCEL_REQUESTED keeps the window it
    // was created with — which may have elapsed long ago: a cancel request can
    // wait for staff approval far longer than the 15-minute payment hold, and
    // CANCEL_REQUESTED itself is exempt from the expiry cron. Without re-arming
    // the window the cron would expire the booking minutes after staff rejected
    // the client's cancellation. Confirmed states carry no window.
    const rearmedExpiry = isUnconfirmedHoldStatus(nextStatus) ? nextHoldExpiry() : null;

    const [updated] = await this.rlsTransaction.withTransaction((tx) => Promise.all([
      updateBookingAtomically(tx, {
        bookingId: cmd.bookingId,
        currentStatus: booking.status,
        actionLabel: 'cancel rejection applied',
        data: {
          status: nextStatus,
          cancelReason: null,
          cancelNotes: null,
          ...(rearmedExpiry ? { expiresAt: rearmedExpiry } : {}),
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
    await this.eventBus.publishOptional(event.eventName, event.toEnvelope());

    return updated;
  }
}
