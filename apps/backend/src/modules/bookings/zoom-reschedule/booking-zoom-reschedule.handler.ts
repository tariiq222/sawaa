import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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
      || (event.payload.revision !== undefined && sync.revision !== event.payload.revision)
    ) {
      throw new ConflictException('Zoom synchronization event does not match durable state');
    }
    if (sync.status === 'COMPLETED' || sync.status === 'SUPERSEDED') return;

    // Pre-transition events had no revision. Multiple old PENDING rows share
    // the backfilled zero, so only the newest durable desired state may touch
    // Zoom; stale deliveries become explicitly superseded.
    if (event.payload.revision === undefined) {
      const newestLegacy = await this.prisma.bookingZoomSync.findFirst({
        where: { bookingId: sync.bookingId, revision: 0 },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (newestLegacy && newestLegacy.id !== sync.id) {
        await this.markSuperseded(sync.id);
        return;
      }
    }

    const latest = await this.prisma.booking.findUnique({
      where: { id: sync.bookingId },
      select: { id: true, zoomMeetingId: true, zoomSyncRevision: true },
    });
    if (!latest) throw new NotFoundException('Booking for Zoom synchronization not found');
    if (latest.zoomMeetingId !== sync.zoomMeetingId || latest.zoomSyncRevision !== sync.revision) {
      await this.markSuperseded(sync.id);
      return;
    }

    const leaseOwner = randomUUID();
    const now = new Date();
    const acquired = await this.prisma.booking.updateMany({
      where: {
        id: sync.bookingId,
        zoomMeetingId: sync.zoomMeetingId,
        zoomSyncRevision: sync.revision,
        OR: [
          { zoomSyncLeaseOwner: null },
          { zoomSyncLeaseExpiresAt: null },
          { zoomSyncLeaseExpiresAt: { lt: now } },
        ],
      },
      data: {
        zoomSyncLeaseOwner: leaseOwner,
        zoomSyncLeaseExpiresAt: new Date(now.getTime() + 60_000),
      },
    });
    if (acquired.count !== 1) {
      throw new ConflictException('Zoom synchronization lease is already held');
    }

    let primaryError: unknown;

    try {
      // The inner closure lets stale revisions stop their own work while the
      // outer scope still releases the durable lease before returning.
      await (async () => {
        await this.prisma.bookingZoomSync.updateMany({
          where: { id: sync.id, status: { notIn: ['COMPLETED', 'SUPERSEDED'] } },
          data: {
            status: 'PROCESSING',
            attemptCount: { increment: 1 },
            lastAttemptAt: new Date(),
            lastError: null,
          },
        });
        if (!await this.isCurrentRevision(sync.bookingId, sync.zoomMeetingId, sync.revision, leaseOwner)) {
          await this.markSuperseded(sync.id);
          return;
        }
        await this.withLeaseHeartbeat(sync.bookingId, leaseOwner, async () => {
          const current = await this.zoom.getMeeting(
            event.payload.organizationId,
            sync.zoomMeetingId,
          );
          const providerAlreadyCurrent =
            current.topic === sync.desiredTopic
            && current.durationMins === sync.desiredDurationMins
            && new Date(current.startTime).getTime() === sync.desiredStartAt.getTime();

          if (!providerAlreadyCurrent) {
            if (!await this.isCurrentRevision(sync.bookingId, sync.zoomMeetingId, sync.revision, leaseOwner)) {
              await this.markSuperseded(sync.id);
              return;
            }
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
        });

        await this.prisma.bookingZoomSync.updateMany({
          where: { id: sync.id, revision: sync.revision, status: { notIn: ['COMPLETED', 'SUPERSEDED'] } },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            lastError: null,
          },
        });
      })();
    } catch (error) {
      primaryError = error;
      try {
        await this.prisma.bookingZoomSync.updateMany({
          where: { id: sync.id, revision: sync.revision, status: 'PROCESSING' },
          data: {
            status: 'PENDING',
            lastError: 'Zoom synchronization failed; retry required',
          },
        });
      } catch (persistError) {
        primaryError = new AggregateError(
          [error, persistError],
          'Zoom synchronization failed and retry state could not be persisted',
        );
      }
    }

    let releaseError: unknown;
    try {
      await this.prisma.booking.updateMany({
        where: { id: sync.bookingId, zoomSyncLeaseOwner: leaseOwner },
        data: { zoomSyncLeaseOwner: null, zoomSyncLeaseExpiresAt: null },
      });
    } catch (error) {
      releaseError = error;
    }
    if (primaryError && releaseError) {
      throw new AggregateError(
        [primaryError, releaseError],
        'Zoom synchronization failed and its lease could not be released',
      );
    }
    if (primaryError) throw primaryError;
    if (releaseError) throw releaseError;
  }

  private async isCurrentRevision(
    bookingId: string,
    zoomMeetingId: string,
    revision: number,
    leaseOwner: string,
  ): Promise<boolean> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        zoomMeetingId: true,
        zoomSyncRevision: true,
        zoomSyncLeaseOwner: true,
        zoomSyncLeaseExpiresAt: true,
      },
    });
    return Boolean(
      booking
      && booking.zoomMeetingId === zoomMeetingId
      && booking.zoomSyncRevision === revision
      && booking.zoomSyncLeaseOwner === leaseOwner,
    );
  }

  /** Keep the exclusive provider fence alive for slow Zoom calls. */
  private async withLeaseHeartbeat<T>(bookingId: string, leaseOwner: string, work: () => Promise<T>): Promise<T> {
    let lost = false;
    const renew = async () => {
      const result = await this.prisma.booking.updateMany({
        where: { id: bookingId, zoomSyncLeaseOwner: leaseOwner },
        data: { zoomSyncLeaseExpiresAt: new Date(Date.now() + 60_000) },
      });
      if (result.count !== 1) lost = true;
    };
    await renew();
    if (lost) throw new ConflictException('Zoom synchronization lease was lost');
    const timer = setInterval(() => { void renew(); }, 15_000);
    try {
      const result = await work();
      if (lost) throw new ConflictException('Zoom synchronization lease was lost');
      return result;
    } finally {
      clearInterval(timer);
    }
  }

  private async markSuperseded(syncId: string): Promise<void> {
    await this.prisma.bookingZoomSync.updateMany({
      where: { id: syncId, status: { notIn: ['COMPLETED', 'SUPERSEDED'] } },
      data: {
        status: 'SUPERSEDED',
        completedAt: new Date(),
        lastError: null,
      },
    });
  }
}
