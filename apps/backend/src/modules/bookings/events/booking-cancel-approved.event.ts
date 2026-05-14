import { BaseEvent } from '../../../common/events';

export interface BookingCancelApprovedPayload {
  bookingId: string;
  clientId: string;
  employeeId: string;
  autoRefund: boolean;
  approverNotes?: string;
}

export class BookingCancelApprovedEvent extends BaseEvent<BookingCancelApprovedPayload> {
  readonly eventName = 'bookings.booking.cancel_approved';

  constructor(payload: BookingCancelApprovedPayload) {
    super({ source: 'bookings', version: 1, payload });
  }
}
