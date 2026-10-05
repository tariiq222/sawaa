import { BaseEvent, stableEventId } from "../../../common/events";
export interface PreviousReceiptRecordedPayload {
  invoiceId: string;
  paymentId: string;
  bookingId: string;
  amount: number;
  currency: string;
  effectiveReceivedAt: string;
  recordedAt: string;
  actorId: string;
  organizationId: string;
}
/** Audit fact only: never treated as PaymentCompleted or DepositPaid. */
export class PreviousReceiptRecordedEvent extends BaseEvent<PreviousReceiptRecordedPayload> {
  readonly eventName = "finance.previous-receipt.recorded";
  constructor(payload: PreviousReceiptRecordedPayload, operationKey: string) {
    super({
      source: "finance",
      version: 1,
      payload,
      eventId: stableEventId(
        `finance:previous-receipt:${operationKey}:${payload.paymentId}`,
      ),
    });
  }
}
