import { BaseEvent } from '../../../common/events';

export interface DepositPaidPayload {
  paymentId: string;
  invoiceId: string;
  /** null for bundle-purchase invoices — deposits only apply to booking invoices */
  bookingId: string | null;
  amount: number;
  currency: string;
  organizationId?: string;
}

/**
 * Emitted when a client pays the EXACT configured service deposit on a booking
 * invoice (deposit < total, so the invoice lands PARTIALLY_PAID — not PAID).
 *
 * bookings/ subscribes to move the booking into DEPOSIT_PAID (reserving the
 * staff time) WITHOUT confirming the appointment. The remaining balance stays
 * due; settling it later emits PaymentCompletedEvent which confirms the booking.
 *
 * Distinct from PaymentCompletedEvent: a deposit is NOT a fully-paid invoice, so
 * receipt/confirmation consumers must not react to it.
 */
export class DepositPaidEvent extends BaseEvent<DepositPaidPayload> {
  readonly eventName = 'finance.payment.deposit_paid';

  constructor(payload: DepositPaidPayload) {
    super({ source: 'finance', version: 1, payload });
  }
}
