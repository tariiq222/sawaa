import { CancellationRefundIntentService } from '../cancellation-refund/cancellation-refund-intent.service';
import { Injectable } from '@nestjs/common';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { BookingCancelledPayload } from '../../bookings/events/booking-cancelled.event';
import { RefundPaymentHandler } from '../refund-payment/refund-payment.handler';

/**
 * Subscribes to bookings.booking.cancelled and automatically triggers a refund
 * when a completed payment exists and the cancellation policy grants one.
 */
@Injectable()
export class OnBookingCancelledRefundHandler {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly refund: RefundPaymentHandler,
    private readonly cancellationRefunds: CancellationRefundIntentService,
  ) {}

  register(): void {
    this.eventBus.subscribe<BookingCancelledPayload>(
      'bookings.booking.cancelled',
      'finance.booking-cancelled-refund',
      (envelope: DomainEventEnvelope<BookingCancelledPayload>) => this.handle(envelope),
    );
  }

  async handle(envelope: DomainEventEnvelope<BookingCancelledPayload>): Promise<void> {
    if (envelope.payload.centerCancellation) {
      await this.cancellationRefunds.execute(envelope.eventId, envelope.payload.bookingId, envelope.payload.clientId, envelope.payload.centerCancellation);
      return;
    }
    if (envelope.payload.clientCancellation) {
      await this.cancellationRefunds.execute(envelope.eventId, envelope.payload.bookingId, envelope.payload.clientId, envelope.payload.clientCancellation);
      return;
    }
    const { refundType, paymentId, bookingId, clientId, refundRequestId, idempotencyKey } = envelope.payload;
    if (refundType === 'NONE' || !paymentId) {
      return;
    }

    if (refundRequestId && idempotencyKey) {
      // Never swallow: BullMQ owns retry/backoff. The RefundRequest ledger and
      // stable provider key make replay safe across every crash window.
      await this.refund.finalizeRefundFromCancellation({
        refundRequestId,
        idempotencyKey,
        sourceEventId: envelope.eventId,
      });
      return;
    }

    await this.refund.execute({
      paymentId,
      reason: `Booking ${bookingId} cancellation (${refundType})`,
      performedBy: clientId ?? 'system',
      ...(envelope.eventId ? { sourceEventId: envelope.eventId } : {}),
    });
  }
}
