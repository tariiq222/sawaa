import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { fetchBookingOrFail, updateBookingAtomically } from '../booking-lifecycle.helper';
import { assertTransition } from '../booking-state-machine';

export interface NoShowBookingCommand {
  bookingId: string;
  changedBy: string;
}

@Injectable()
export class NoShowBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
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
    const [updated] = await this.rlsTransaction.withTransaction((tx) => Promise.all([
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
    ]));
    return updated;
  }
}
