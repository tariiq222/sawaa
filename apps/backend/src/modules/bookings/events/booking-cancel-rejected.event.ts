import { BaseEvent } from '../../../common/events';

export interface BookingCancelRejectedPayload {
  bookingId: string;
  clientId: string;
  employeeId: string;
  rejectReason: string;
}

export class BookingCancelRejectedEvent extends BaseEvent<BookingCancelRejectedPayload> {
  readonly eventName = 'bookings.booking.cancel_rejected';

  constructor(payload: BookingCancelRejectedPayload) {
    super({ source: 'bookings', version: 1, payload });
  }
}
