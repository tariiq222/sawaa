import { Injectable } from "@nestjs/common";
import { EventBusService } from "../../../infrastructure/events";
import type { EventHandler } from "../../../infrastructure/events/event-bus.service";
import type { PreviousReceiptRecordedPayload } from "./previous-receipt-recorded.event";

/**
 * Acknowledge the immutable audit fact through the durable consumer queue.
 * Money and invoice state already committed with this outbox event. The
 * retained outbox payload is the audit record; consuming it must not repeat
 * financial work, change a booking, or trigger document delivery/notifications.
 */
@Injectable()
export class PreviousReceiptRecordedAuditHandler {
  constructor(private readonly eventBus: EventBusService) {}

  register(): void {
    const acknowledge: EventHandler<PreviousReceiptRecordedPayload> = () =>
      undefined;
    this.eventBus.subscribe(
      "finance.previous-receipt.recorded",
      "finance.previous-receipt-audit.v1",
      acknowledge,
    );
  }
}
