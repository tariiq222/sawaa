import { BaseEvent } from '../../../common/events';

export interface PaymentFailedPayload {
  paymentId: string;
  invoiceId: string;
  clientId: string;
  amount: number;
  currency: string;
  reason?: string;
  clientEmail?: string;
  clientName?: string;
  fcmToken?: string;
  // SaaS-02e — optional during rollout; made required in 02f once all
  // producers set it.
  organizationId?: string;
}

/**
 * Emitted when a payment transitions to FAILED status.
 * comms/on-payment-failed subscribes to notify the client.
 */
export class PaymentFailedEvent extends BaseEvent<PaymentFailedPayload> {
  readonly eventName = 'finance.payment.failed';

  constructor(payload: PaymentFailedPayload) {
    super({ source: 'finance', version: 1, payload });
  }
}
