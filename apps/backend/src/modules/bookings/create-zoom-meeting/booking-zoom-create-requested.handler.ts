import { Injectable } from '@nestjs/common';
import { EventBusService } from '../../../infrastructure/events';
import type { BookingZoomCreateRequestedPayload } from '../events/booking-zoom-create-requested.event';
import { CreateZoomMeetingHandler } from './create-zoom-meeting.handler';

@Injectable()
export class BookingZoomCreateRequestedHandler {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly createZoomMeeting: CreateZoomMeetingHandler,
  ) {}

  register(): void {
    this.eventBus.subscribe<BookingZoomCreateRequestedPayload>(
      'bookings.zoom.create_requested',
      'bookings.zoom-create.v1',
      async ({ payload }) => {
        // Never swallow: BullMQ must retain the durable event on a transient
        // provider/DB failure. The handler itself makes replay provider-safe.
        await this.createZoomMeeting.execute({ bookingId: payload.bookingId });
      },
    );
  }
}
