import { RefundType } from '@prisma/client';
import { BaseEvent } from '../../../common/events';

export interface BookingCancelApprovedPayload {
  bookingId: string;
  clientId: string;
  employeeId: string;
  autoRefund: boolean;
  approverNotes?: string;
  /** Refund decision recorded by the approver — informational; execution is a manual finance flow. */
  refundType?: RefundType;
  /** Refund amount in halalas — only present when refundType is PARTIAL. */
  refundAmount?: number;
}

export class BookingCancelApprovedEvent extends BaseEvent<BookingCancelApprovedPayload> {
  readonly eventName = 'bookings.booking.cancel_approved';

  constructor(payload: BookingCancelApprovedPayload) {
    super({ source: 'bookings', version: 1, payload });
  }
}
