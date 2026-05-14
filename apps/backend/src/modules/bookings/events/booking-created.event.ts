import { BaseEvent } from '../../../common/events';

export interface BookingCreatedPayload {
  bookingId: string;
  clientId: string;
  employeeId: string;
  organizationId: string;
  scheduledAt: Date;
  serviceId: string;
}

export class BookingCreatedEvent extends BaseEvent<BookingCreatedPayload> {
  readonly eventName = 'bookings.booking.created';

  constructor(payload: BookingCreatedPayload) {
    super({ source: 'bookings', version: 1, payload });
  }
}
