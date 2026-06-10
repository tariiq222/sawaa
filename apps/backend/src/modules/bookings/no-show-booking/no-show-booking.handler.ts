import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { fetchBookingOrFail, updateBookingAtomically } from '../booking-lifecycle.helper';
import { assertTransition } from '../booking-state-machine';
import { GroupSessionCapacityService } from '../group-session/group-session-capacity.service';

export interface NoShowBookingCommand {
  bookingId: string;
  changedBy: string;
}

@Injectable()
export class NoShowBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly groupSessionCapacity: GroupSessionCapacityService,
  ) {}

  async execute(cmd: NoShowBookingCommand) {
    const booking = await fetchBookingOrFail(this.prisma, cmd.bookingId, [BookingStatus.CONFIRMED], 'marked as no-show');
    const nextStatus = assertTransition(booking.status, 'NO_SHOW');

    // FINANCIAL CONSEQUENCE — NO_SHOW = full forfeiture.
    // A no-show carries a financial consequence: the client forfeits the
    // session and is NOT refunded. This handler deliberately does NOT publish
    // a BookingCancelledEvent and does NOT create a RefundRequest, so the
    // auto-refund-on-cancel path (OnBookingCancelledRefundHandler) never fires
    // for a no-show. The paid amount is retained in full.
    //
    // FOLLOWUP: a configurable no-show fee/penalty (e.g. a
    // `noShowRefundPercent` or `noShowFeeHalalas` field on BookingSettings)
    // would let the clinic refund a portion instead of voiding entirely.
    // No such settings field exists today; do not invent a schema column.
    const updated = await this.rlsTransaction.withTransaction(async (tx) => {
      const [noShowBooking] = await Promise.all([
        updateBookingAtomically(tx, {
          bookingId: cmd.bookingId,
          currentStatus: booking.status,
          actionLabel: 'marked as no-show',
          data: { status: nextStatus, noShowAt: new Date() },
        }),
        tx.bookingStatusLog.create({
          data: {
            bookingId: cmd.bookingId,
            fromStatus: booking.status,
            toStatus: nextStatus,
            changedBy: cmd.changedBy,
            reason: 'No-show — session forfeited, no refund issued',
          },
        }),
      ]);

      // NO_SHOW leaves GROUP_CAPACITY_BOOKING_STATUSES (CONFIRMED → NO_SHOW),
      // so a group enrollee must release their seat: guarded enrolledCount
      // decrement + sibling rollback inside the same transaction (mirrors
      // cancel-booking.handler). Money handling above is unaffected — the
      // forfeiture rule stands.
      if (booking.groupSessionId) {
        await this.groupSessionCapacity.recalculateGroupStatus(tx, booking.groupSessionId);
      }

      return noShowBooking;
    });
    return updated;
  }
}
