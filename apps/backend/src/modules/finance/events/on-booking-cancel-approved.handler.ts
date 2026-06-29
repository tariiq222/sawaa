import { Injectable, Logger } from '@nestjs/common';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { BookingCancelApprovedPayload } from '../../bookings/events/booking-cancel-approved.event';
import { RefundPaymentHandler } from '../refund-payment/refund-payment.handler';

/**
 * Subscribes to bookings.booking.cancel_approved (dashboard "approve cancel
 * request") and finalizes the refund that ApproveCancelBookingHandler created
 * atomically with the status flip.
 *
 * P0 fix: previously NOTHING listened to this event — the RefundRequest stayed
 * in PROCESSING forever, Moyasar was never called, and the money was never
 * returned. The cancelled-event path (OnBookingCancelledRefundHandler) only
 * fires on the DIRECT_CANCEL flow, so the approval flow was silently dropped.
 *
 * The handler mirrors the cancelled-event finalize step: it calls
 * finalizeRefundFromCancellation, which is idempotent (skips if the request is
 * already COMPLETED) and which, for off-gateway (cash/bank-transfer) refunds
 * settled in-tx, makes no external Moyasar call at all.
 */
@Injectable()
export class OnBookingCancelApprovedRefundHandler {
  private readonly logger = new Logger(OnBookingCancelApprovedRefundHandler.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly refund: RefundPaymentHandler,
  ) {}

  register(): void {
    this.eventBus.subscribe<BookingCancelApprovedPayload>(
      'bookings.booking.cancel_approved',
      (envelope: DomainEventEnvelope<BookingCancelApprovedPayload>) => this.handle(envelope),
    );
  }

  async handle(envelope: DomainEventEnvelope<BookingCancelApprovedPayload>): Promise<void> {
    const { bookingId, refundRequestId, idempotencyKey } = envelope.payload;

    // The approval handler only sets refundRequestId/idempotencyKey when a
    // refund was actually created (completed payment + effective refund type
    // other than NONE). Absence here means there is nothing to settle.
    if (!refundRequestId || !idempotencyKey) {
      return;
    }

    try {
      await this.refund.finalizeRefundFromCancellation({ refundRequestId, idempotencyKey });
    } catch (err) {
      this.logger.error(
        `Finalize refund from cancel-approval failed for booking ${bookingId} refundRequest ${refundRequestId}`,
        err,
      );
    }
  }
}
