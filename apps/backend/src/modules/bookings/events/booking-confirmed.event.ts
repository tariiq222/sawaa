import { BaseEvent } from '../../../common/events';

export interface BookingConfirmedPayload {
  bookingId: string;
  clientId: string;
  employeeId: string;
  branchId: string;
  serviceId: string;
  scheduledAt: Date;
  price: number;
  currency: string;
  couponCode?: string | null;
  discountedPrice?: number | null;
  bookingType: string;
}

/**
 * Emitted when a booking is confirmed.
 * finance/ subscribes to create an invoice automatically.
 * comms/ subscribes to send confirmation notification.
 */
export class BookingConfirmedEvent extends BaseEvent<BookingConfirmedPayload> {
  readonly eventName = 'bookings.booking.confirmed';

  constructor(payload: BookingConfirmedPayload) {
    super({ source: 'bookings', version: 1, payload });
  }
}
