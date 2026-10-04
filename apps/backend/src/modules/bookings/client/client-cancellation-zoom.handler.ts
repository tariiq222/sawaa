import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import type { BookingCancelledPayload } from '../events/booking-cancelled.event';
import { ZoomMeetingService } from '../zoom-meeting.service';

@Injectable()
export class ClientCancellationZoomHandler {
  constructor(private readonly prisma: PrismaService, private readonly bus: EventBusService, private readonly zoom: ZoomMeetingService) {}
  register(): void {
    this.bus.subscribe<BookingCancelledPayload>('bookings.booking.cancelled', 'bookings.client-cancel-zoom.v1', e => this.handle(e));
  }
  async handle(event: DomainEventEnvelope<BookingCancelledPayload>): Promise<void> {
    const { clientCancellation, legacyClientCancellation, zoomMeetingId, bookingId, organizationId } = event.payload;
    if ((!clientCancellation && legacyClientCancellation !== true) || !zoomMeetingId) return;
    if (event.version !== 1 || (clientCancellation && clientCancellation.version !== 1)) throw new Error('Unsupported client cancellation event');
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: { status: true, zoomMeetingId: true } });
    if (!booking || booking.status !== 'CANCELLED' || booking.zoomMeetingId !== zoomMeetingId) return;
    // Remote deletion is idempotent. Keep the identifier until success for retry.
    await this.zoom.deleteMeetingStrict(organizationId, zoomMeetingId);
    await this.prisma.booking.updateMany({ where: { id: bookingId, status: 'CANCELLED', zoomMeetingId }, data: { zoomMeetingId: null, zoomJoinUrl: null, zoomHostUrl: null, zoomStartUrl: null, zoomMeetingStatus: 'CANCELLED' } });
  }
}
