import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { ZoomMeetingService } from '../zoom-meeting.service';
import type { BookingZoomRescheduleRequestedPayload } from '../events/booking-zoom-reschedule-requested.event';

@Injectable()
export class BookingZoomRescheduleHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly zoom: ZoomMeetingService,
  ) {}

  register(): void {
    this.eventBus.subscribe<BookingZoomRescheduleRequestedPayload>(
      'bookings.zoom.reschedule_requested',
      'bookings.zoom-reschedule',
      (event) => this.handle(event),
    );
  }

  async handle(
    event: DomainEventEnvelope<BookingZoomRescheduleRequestedPayload>,
  ): Promise<void> {
    const sync = await this.prisma.bookingZoomSync.findUnique({
      where: { eventId: event.eventId },
    });
    if (!sync) throw new NotFoundException('Zoom synchronization request not found');
    if (
      sync.id !== event.payload.syncId
      || sync.bookingId !== event.payload.bookingId
      || sync.zoomMeetingId !== event.payload.zoomMeetingId
    ) {
      throw new ConflictException('Zoom synchronization event does not match durable state');
    }
    if (sync.status === 'COMPLETED') return;

    await this.prisma.bookingZoomSync.update({
      where: { id: sync.id },
      data: {
        status: 'PROCESSING',
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        lastError: null,
      },
    });

    try {
      const current = await this.zoom.getMeeting(
        event.payload.organizationId,
        sync.zoomMeetingId,
      );
      const providerAlreadyCurrent =
        current.topic === sync.desiredTopic
        && current.durationMins === sync.desiredDurationMins
        && new Date(current.startTime).getTime() === sync.desiredStartAt.getTime();

      if (!providerAlreadyCurrent) {
        await this.zoom.updateMeeting(
          event.payload.organizationId,
          sync.zoomMeetingId,
          {
            topic: sync.desiredTopic,
            startTime: sync.desiredStartAt.toISOString(),
            durationMins: sync.desiredDurationMins,
          },
        );
      }

      await this.prisma.bookingZoomSync.updateMany({
        where: { id: sync.id, status: { not: 'COMPLETED' } },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          lastError: null,
        },
      });
    } catch (error) {
      try {
        await this.prisma.bookingZoomSync.update({
          where: { id: sync.id },
          data: {
            status: 'PENDING',
            lastError: 'Zoom synchronization failed; retry required',
          },
        });
      } catch (persistError) {
        throw new AggregateError(
          [error, persistError],
          'Zoom synchronization failed and retry state could not be persisted',
        );
      }
      throw error;
    }
  }
}
