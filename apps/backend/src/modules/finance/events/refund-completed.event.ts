import { BaseEvent } from '../../../common/events';

export interface RefundCompletedPayload {
  refundRequestId: string;
  organizationId: string;
  invoiceId: string;
  paymentId: string;
  bookingId: string;
  amount: number;
  currency: string;
}

/**
 * Emitted when a refund reaches COMPLETED status — either via the
 * gateway-driven `ApproveRefundHandler` flow (Moyasar refund) or the
 * legacy single-step `RefundPaymentHandler` flow.
 *
 * billing/ subscribes to decrement the corresponding UsageCounter rows
 * (idempotently, via RefundUsageRevertLog).
 */
export class RefundCompletedEvent extends BaseEvent<RefundCompletedPayload> {
  readonly eventName = 'finance.refund.completed';

  constructor(payload: RefundCompletedPayload) {
    super({ source: 'finance', version: 1, payload });
  }
}
