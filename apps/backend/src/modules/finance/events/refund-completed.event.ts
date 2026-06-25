import { BaseEvent } from '../../../common/events';

export interface RefundCompletedPayload {
  refundRequestId: string;
  organizationId: string;
  invoiceId: string;
  paymentId: string;
  /** null for package-purchase invoices */
  bookingId: string | null;
  amount: number;
  currency: string;
}

/**
 * Emitted when a refund reaches COMPLETED status — either via the
 * gateway-driven `ApproveRefundHandler` flow (Moyasar refund) or the
 * legacy single-step `RefundPaymentHandler` flow.
 */
export class RefundCompletedEvent extends BaseEvent<RefundCompletedPayload> {
  readonly eventName = 'finance.refund.completed';

  constructor(payload: RefundCompletedPayload) {
    super({ source: 'finance', version: 1, payload });
  }
}
