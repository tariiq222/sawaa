import { Injectable } from '@nestjs/common';
import { BookingStatus, CancellationReason, RefundType } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { EventBusService } from '../../../infrastructure/events';
import { RefundPaymentHandler } from '../../finance/refund-payment/refund-payment.handler';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { BookingCancelledEvent } from '../events/booking-cancelled.event';
import { fetchBookingOrFail } from '../booking-lifecycle.helper';
import { assertTransition } from '../booking-state-machine';

export interface ExpireBookingCommand {
  bookingId: string;
  changedBy: string;
}

@Injectable()
export class ExpireBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly eventBus: EventBusService,
    private readonly refundHandler: RefundPaymentHandler,
  ) {}

  async execute(cmd: ExpireBookingCommand) {
    const booking = await fetchBookingOrFail(
      this.prisma,
      cmd.bookingId,
      [BookingStatus.PENDING, BookingStatus.PENDING_GROUP_FILL, BookingStatus.AWAITING_PAYMENT],
      'expired',
    );
    const nextStatus = assertTransition(booking.status, 'EXPIRE');

    // MONEY-SAFETY (P1): a booking can be expired after a deposit has been
    // collected (invoice PARTIALLY_PAID). Mirror the cancel-booking refund
    // path so the captured payment is refunded in FULL instead of being
    // silently forfeited.
    const completedPayment = await this.prisma.payment.findFirst({
      where: { invoice: { bookingId: booking.id }, status: 'COMPLETED' },
      select: { id: true, amount: true, refundedAmount: true },
    });

    let refundRequestId: string | null = null;
    let idempotencyKey: string | null = null;

    const updated = await this.rlsTransaction.withTransaction(async (tx) => {
      const [expiredBooking] = await Promise.all([
        tx.booking.update({
          where: { id: cmd.bookingId },
          data: { status: nextStatus, expiresAt: new Date() },
        }),
        tx.bookingStatusLog.create({
          data: {
            bookingId: cmd.bookingId,
            fromStatus: booking.status,
            toStatus: nextStatus,
            changedBy: cmd.changedBy,
          },
        }),
      ]);

      if (completedPayment) {
        // FULL refund — amount left undefined so the finance handler refunds
        // the whole paid amount. Created inside the same transaction as the
        // status flip so a concurrent double-expiry cannot skip the refund.
        const created = await this.refundHandler.createRefundRequestInTx(tx, {
          paymentId: completedPayment.id,
          reason: `Booking ${booking.id} expired (deposit refund)`,
          performedBy: cmd.changedBy,
        });
        refundRequestId = created.refundRequestId;
        idempotencyKey = created.idempotencyKey;
      }

      return expiredBooking;
    });

    // Reuse the existing cancellation/refund event so
    // OnBookingCancelledRefundHandler finalizes the pre-created refund via
    // the atomic Phase 1 + Phase 3 path (refundRequestId + idempotencyKey).
    const event = new BookingCancelledEvent({
      organizationId: DEFAULT_ORG_ID,
      scheduledAt: booking.scheduledAt,
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      clientId: booking.clientId,
      employeeId: booking.employeeId,
      reason: CancellationReason.SYSTEM_EXPIRED,
      zoomMeetingId: booking.zoomMeetingId ?? null,
      refundType: completedPayment ? RefundType.FULL : RefundType.NONE,
      paymentId: completedPayment?.id ?? null,
      refundRequestId,
      idempotencyKey,
    });
    await this.eventBus.publish(event.eventName, event.toEnvelope());

    return updated;
  }
}
