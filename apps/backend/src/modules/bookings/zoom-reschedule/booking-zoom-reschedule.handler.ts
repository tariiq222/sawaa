import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { ZoomMeetingService } from '../zoom-meeting.service';
import type { BookingZoomRescheduleRequestedPayload } from '../events/booking-zoom-reschedule-requested.event';

const ZOOM_SYNC_ELIGIBLE_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.DEPOSIT_PAID,
  // A request is reversible; keep the existing desired outbox event alive so
  // rejecting the request does not require synthesizing a replacement event.
  BookingStatus.CANCEL_REQUESTED,
];

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

    const latest = await this.prisma.booking.findUnique({
      where: { id: sync.bookingId },
      select: {
        id: true,
        zoomMeetingId: true,
        zoomSyncRevision: true,
        scheduledAt: true,
        durationMins: true,
        status: true,
      },
    });
    if (!latest) throw new NotFoundException('Booking for Zoom synchronization not found');
    // Multiple pre-transition events have revision zero. Their createdAt and
    // UUID are not a causal order, so the only safe winner is the desired row
    // that still equals the booking's durable current schedule. A stale row is
    // terminally superseded before it can lease or PATCH the remote meeting.
    const matchesLegacyDesiredState = event.payload.revision !== undefined
      || (
        latest.scheduledAt.getTime() === sync.desiredStartAt.getTime()
        && latest.durationMins === sync.desiredDurationMins
      );
    if (
      latest.zoomMeetingId !== sync.zoomMeetingId
      || latest.zoomSyncRevision !== sync.revision
      || !ZOOM_SYNC_ELIGIBLE_STATUSES.includes(latest.status)
      || !matchesLegacyDesiredState
    ) {
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
        status: { in: ZOOM_SYNC_ELIGIBLE_STATUSES },
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
        await this.withLeaseHeartbeat(sync.bookingId, leaseOwner, async (assertLeaseHealthy) => {
          assertLeaseHealthy();
          const current = await this.zoom.getMeeting(
            event.payload.organizationId,
            sync.zoomMeetingId,
          );
          assertLeaseHealthy();
          const providerAlreadyCurrent =
            current.topic === sync.desiredTopic
            && current.durationMins === sync.desiredDurationMins
            && new Date(current.startTime).getTime() === sync.desiredStartAt.getTime();

          if (!providerAlreadyCurrent) {
            if (!await this.isCurrentRevision(sync.bookingId, sync.zoomMeetingId, sync.revision, leaseOwner)) {
              await this.markSuperseded(sync.id);
              return;
            }
            assertLeaseHealthy();
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

        // Cancellation/status transition is lifecycle-fenced by this lease in
        // current writers, but older writes can race. Re-check it before the
        // terminal sync state so a queued post-cancel event never succeeds.
        if (!await this.isCurrentRevision(sync.bookingId, sync.zoomMeetingId, sync.revision, leaseOwner)) {
          await this.markSuperseded(sync.id);
          return;
        }

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
        status: true,
      },
    });
    return Boolean(
      booking
      && booking.zoomMeetingId === zoomMeetingId
      && booking.zoomSyncRevision === revision
      && booking.zoomSyncLeaseOwner === leaseOwner
      && ZOOM_SYNC_ELIGIBLE_STATUSES.includes(booking.status),
    );
  }

  /** Keep the exclusive provider fence alive for slow Zoom calls. */
  private async withLeaseHeartbeat<T>(
    bookingId: string,
    leaseOwner: string,
    work: (assertLeaseHealthy: () => void) => Promise<T>,
  ): Promise<T> {
    let renewalFailure: unknown;
    let renewal = Promise.resolve();
    const assertLeaseHealthy = () => {
      if (renewalFailure) throw new ConflictException('Zoom synchronization lease was lost');
    };
    // A serial promise chain observes every timer failure. Timers only enqueue
    // work; they never leave a rejected Promise unhandled.
    const renew = () => {
      renewal = renewal.then(async () => {
        const result = await this.prisma.booking.updateMany({
          where: { id: bookingId, zoomSyncLeaseOwner: leaseOwner },
          data: { zoomSyncLeaseExpiresAt: new Date(Date.now() + 60_000) },
        });
        if (result.count !== 1) throw new ConflictException('Zoom synchronization lease was lost');
      }).catch((error) => { renewalFailure ??= error; });
      return renewal;
    };
    const timer = setInterval(renew, 15_000);
    try {
      const result = await work(assertLeaseHealthy);
      await renewal;
      assertLeaseHealthy();
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
