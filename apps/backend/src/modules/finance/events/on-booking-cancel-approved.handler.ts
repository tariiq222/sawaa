import { Injectable } from '@nestjs/common';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { BookingCancelApprovedPayload } from '../../bookings/events/booking-cancel-approved.event';
import { CancellationRefundIntentService } from '../cancellation-refund/cancellation-refund-intent.service';
import { RefundPaymentHandler } from '../refund-payment/refund-payment.handler';

/** Settles frozen staff intents; old singular-refund events remain replayable. */
@Injectable()
export class OnBookingCancelApprovedRefundHandler {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly refund: RefundPaymentHandler,
    private readonly intents: CancellationRefundIntentService,
  ) {}

  register(): void {
    this.eventBus.subscribe<BookingCancelApprovedPayload>(
      'bookings.booking.cancel_approved',
      'finance.booking-cancel-approved-refund',
      (envelope: DomainEventEnvelope<BookingCancelApprovedPayload>) => this.handle(envelope),
    );
  }

  async handle(envelope: DomainEventEnvelope<BookingCancelApprovedPayload>): Promise<void> {
    const { staffCancellation, bookingId, clientId } = envelope.payload;
    if (staffCancellation) {
      await this.intents.execute(envelope.eventId, bookingId, clientId, staffCancellation);
      return;
    }
    const { refundRequestId, idempotencyKey } = envelope.payload;

    // The approval handler only sets refundRequestId/idempotencyKey when a
    // refund was actually created (completed payment + effective refund type
    // other than NONE). Absence here means there is nothing to settle.
    if (!refundRequestId || !idempotencyKey) {
      return;
    }

    await this.refund.finalizeRefundFromCancellation({
      refundRequestId,
      idempotencyKey,
      ...(envelope.eventId ? { sourceEventId: envelope.eventId } : {}),
    });
  }
}
