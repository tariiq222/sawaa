import { RefundType } from '@prisma/client';
import { BaseEvent } from '../../../common/events';

export interface BookingCancelApprovedPayload {
  bookingId: string;
  clientId: string;
  employeeId: string;
  autoRefund: boolean;
  approverNotes?: string;
  /** Refund decision recorded by the approver. */
  refundType?: RefundType;
  /** Refund amount in halalas — only present when refundType is PARTIAL. */
  refundAmount?: number;
  /** Payment id that was refunded — null when booking was not paid or no refund was issued. */
  paymentId?: string | null;
  /** RefundRequest id created atomically with the cancellation — null when no refund was created. */
  refundRequestId?: string | null;
  /** Idempotency key for the refund — null when no refund was created. */
  idempotencyKey?: string | null;
}

export class BookingCancelApprovedEvent extends BaseEvent<BookingCancelApprovedPayload> {
  readonly eventName = 'bookings.booking.cancel_approved';

  constructor(payload: BookingCancelApprovedPayload) {
    super({ source: 'bookings', version: 1, payload });
  }
}
