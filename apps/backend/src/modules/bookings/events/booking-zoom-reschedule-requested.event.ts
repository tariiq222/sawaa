import { BaseEvent } from '../../../common/events';

export interface BookingZoomRescheduleRequestedPayload {
  organizationId: string;
  syncId: string;
  bookingId: string;
  zoomMeetingId: string;
}

export class BookingZoomRescheduleRequestedEvent extends BaseEvent<BookingZoomRescheduleRequestedPayload> {
  readonly eventName = 'bookings.zoom.reschedule_requested';

  constructor(payload: BookingZoomRescheduleRequestedPayload, eventId: string) {
    super({ source: 'bookings', version: 1, payload, eventId });
  }
}
