import { Injectable } from '@nestjs/common';
import { EventBusService } from '../../../infrastructure/events';

/**
 * Retires the former refund-to-cancellation cascade without abandoning its
 * durable queue. A financial refund never changes the appointment lifecycle;
 * explicit booking cancellation owns credit/capacity release and Zoom cleanup.
 *
 * Keep the stable consumer id: existing dedicated/legacy jobs must acknowledge
 * safely, and finance refund outbox publication requires a registered consumer.
 * This acknowledgement is intentionally independent of booking state and has
 * no database/provider effects, including on replay. Remove it only alongside
 * an explicit outbox routing and legacy-queue retirement plan.
 */
@Injectable()
export class RefundCompletedCompatibilityHandler {
  constructor(private readonly eventBus: EventBusService) {}

  register(): void {
    this.eventBus.subscribe(
      'finance.refund.completed',
      'bookings.refund-completed.v1',
      () => {
        // Acknowledge the financial outcome; it is not a cancellation command.
      },
    );
  }
}
