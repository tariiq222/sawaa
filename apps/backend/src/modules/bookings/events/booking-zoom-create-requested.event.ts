import { BaseEvent, stableEventId } from '../../../common/events';

export interface BookingZoomCreateRequestedPayload {
  organizationId: string;
  bookingId: string;
}

export class BookingZoomCreateRequestedEvent extends BaseEvent<BookingZoomCreateRequestedPayload> {
  readonly eventName = 'bookings.zoom.create_requested';

  constructor(payload: BookingZoomCreateRequestedPayload) {
    super({
      source: 'bookings',
      version: 1,
      payload,
      eventId: stableEventId(`booking:${payload.bookingId}:zoom-create`),
    });
  }
}
