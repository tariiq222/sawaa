import { Injectable, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ActivityAction, BookingStatus, Prisma, type DeliveryType } from '@prisma/client';

/** Re-map a Postgres exclusion violation (23P01) to a domain 409 conflict. */
function mapDbConflict(err: unknown): never {
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2010' &&
    (err.meta as Record<string, unknown> | undefined)?.['code'] === '23P01'
  ) {
    throw new ConflictException('Employee already has a booking in the new time slot');
  }
  throw err;
}
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { retrySerializableTransaction } from '../../../common/database/person-reference-lock.helper';

/** Enough attempts for a small burst of reschedules queued on one client lock. */
export const RESCHEDULE_TX_ATTEMPTS = 4;
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { RescheduleBookingDto } from './reschedule-booking.dto';
import { fetchBookingOrFail, updateBookingAtomically, hashToInt32 } from '../booking-lifecycle.helper';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { randomUUID } from 'node:crypto';
import { BookingZoomRescheduleRequestedEvent } from '../events/booking-zoom-reschedule-requested.event';
import { ZoomMeetingService } from '../zoom-meeting.service';
import { CheckAvailabilityHandler } from '../check-availability/check-availability.handler';
import { assertTransition } from '../booking-state-machine';
import { ACTIVE_BOOKING_STATUSES, STAFF_TIME_BLOCKING_BOOKING_STATUSES } from '../active-booking-statuses';

export type RescheduleBookingCommand = Omit<RescheduleBookingDto, 'newScheduledAt'> & {
  bookingId: string;
  newScheduledAt: Date;
  changedBy: string;
  clientId?: string;
};

@Injectable()
export class RescheduleBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly settingsHandler: GetBookingSettingsHandler,
    // Retained as a constructor dependency for backwards-compatible module
    // wiring; all provider work now goes through the durable outbox protocol.
    _zoomMeetingService: ZoomMeetingService,
    private readonly availabilityHandler: CheckAvailabilityHandler,
  ) {}

  async execute(cmd: RescheduleBookingCommand) {
    const booking = await fetchBookingOrFail(this.prisma, cmd.bookingId, [BookingStatus.PENDING, BookingStatus.CONFIRMED], 'rescheduled');
    // RESCHEDULE is a self-loop: status stays the same (PENDING or CONFIRMED)
    assertTransition(booking.status, 'RESCHEDULE');
    if (cmd.clientId && booking.clientId !== cmd.clientId) {
      throw new ForbiddenException('Not your booking');
    }

    const newScheduledAt = new Date(cmd.newScheduledAt);
    if (newScheduledAt <= new Date()) {
      throw new BadRequestException('New scheduled time must be in the future');
    }

    const settings = await this.settingsHandler.execute({
      branchId: booking.branchId,
    });

    if (
      booking.packageCreditId &&
      cmd.newDurationMins != null &&
      cmd.newDurationMins !== booking.durationMins
    ) {
      // The credit fixes the session length. Changing it would deliver a
      // different service unit than the one the client pre-paid for.
      throw new BadRequestException(
        'Package-funded bookings keep the duration of their package credit',
      );
    }
    const durationMins = cmd.newDurationMins ?? booking.durationMins;
    const newEndsAt = new Date(newScheduledAt.getTime() + durationMins * 60_000);

    await this.assertSlotAvailable({
      bookingId: cmd.bookingId,
      employeeId: booking.employeeId,
      branchId: booking.branchId,
      serviceId: booking.serviceId!,
      scheduledAt: newScheduledAt,
      durationMins,
      durationOptionId: booking.durationOptionId,
      bookingType: booking.bookingType,
      deliveryType: booking.deliveryType,
    });

    // Serialize conflict check + update + status log inside one transaction.
    const zoomSyncEventId = booking.zoomMeetingId ? randomUUID() : null;
    // A concurrent reschedule of the same booking aborts the other Serializable
    // transactions; retry with a fresh snapshot so each loser gets the real
    // outcome (e.g. the reschedule limit) instead of a 500. Requests queued on
    // the client lock abort one after another, so allow several attempts.
    const [updated] = await retrySerializableTransaction(() => this.rlsTransaction.withTransaction(async (tx) => {
        // Lock order shared with the client reschedule and create-booking:
        // client, then booking row, then employee/slot. A different order
        // lets a staff and a client reschedule of the same booking deadlock.
        if (booking.clientId) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${hashToInt32('client_booking')}::int, ${hashToInt32(booking.clientId)}::int)`;
        }

        // Lock the booking row, then re-read it: a retried attempt must build
        // on the status, time and Zoom revision committed by the transaction
        // it lost to, not on the snapshot loaded before the first attempt.
        await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${cmd.bookingId} FOR UPDATE`;
        const locked = await tx.booking.findUnique({
          where: { id: cmd.bookingId },
          select: { status: true, scheduledAt: true, durationMins: true, zoomSyncRevision: true },
        });
        if (!locked) throw new BadRequestException(`Booking ${cmd.bookingId} not found`);
        // The duration, end time, availability check and slot lock above were
        // derived from the pre-transaction snapshot. If a concurrent reschedule
        // changed the duration, writing ours would silently revert it.
        if (cmd.newDurationMins == null && locked.durationMins !== booking.durationMins) {
          throw new ConflictException('Booking was changed concurrently; reload and try again');
        }
        const nextStatus = assertTransition(locked.status, 'RESCHEDULE');

        // Parity with create-booking (CR-5): acquire an advisory lock scoped to
        // employee + new slot window BEFORE the conflict check so a concurrent
        // create/reschedule on the same slot cannot both see "no conflict" and
        // both proceed (TOCTOU double-booking race).
        const lockKey1 = hashToInt32(`${booking.employeeId}`);
        const lockKey2 = hashToInt32(`${newScheduledAt.toISOString()}:${newEndsAt.toISOString()}`);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey1}::int, ${lockKey2}::int)`;

        const rescheduleCount = await tx.bookingStatusLog.count({
          where: { bookingId: cmd.bookingId, reason: 'rescheduled' },
        });
        if (rescheduleCount >= settings.maxReschedulesPerBooking) {
          throw new BadRequestException(
            `Maximum reschedules (${settings.maxReschedulesPerBooking}) reached for this booking`,
          );
        }

        // The client must not end up with two overlapping active appointments
        // (same rule as create-booking and client reschedule).
        if (booking.clientId) {
          const clientConflict = await tx.booking.findFirst({
            where: {
              clientId: booking.clientId,
              id: { not: cmd.bookingId },
              status: { in: [...ACTIVE_BOOKING_STATUSES] },
              isHistoricalImport: false,
              scheduledAt: { lt: newEndsAt },
              endsAt: { gt: newScheduledAt },
            },
            select: { id: true },
          });
          if (clientConflict) {
            throw new ConflictException('Client already has an overlapping appointment');
          }
        }

        // Parity with create-booking: respect the branch bufferMinutes when
        // looking for overlaps so a rescheduled booking cannot land inside
        // another booking's buffer window.
        const bufferMs = (settings.bufferMinutes ?? 0) * 60_000;
        const bufferedStart = new Date(newScheduledAt.getTime() - bufferMs);
        const bufferedEnd = new Date(newEndsAt.getTime() + bufferMs);

        const conflict = await tx.booking.findFirst({
          where: {
            employeeId: booking.employeeId,
            id: { not: cmd.bookingId },
            status: { in: [...STAFF_TIME_BLOCKING_BOOKING_STATUSES] },
            scheduledAt: { lt: bufferedEnd },
            endsAt: { gt: bufferedStart },
          },
          select: { id: true },
        });
        if (conflict) {
          throw new ConflictException('Employee already has a booking in the new time slot');
        }

        const revision = booking.zoomMeetingId ? (locked.zoomSyncRevision ?? 0) + 1 : null;
        const writes: Array<Promise<unknown> | Prisma.PrismaPromise<unknown>> = [
          updateBookingAtomically(tx, {
            bookingId: cmd.bookingId,
            currentStatus: locked.status,
            actionLabel: 'rescheduled',
            data: {
              scheduledAt: newScheduledAt,
              endsAt: newEndsAt,
              durationMins,
              autoNoShowSuppressedAt: null,
              ...(revision === null ? {} : { zoomSyncRevision: revision }),
            },
            ...(booking.deliveryType === 'ONLINE' || booking.zoomMeetingId
              ? {
                  extraWhere: {
                    AND: [
                      ...(booking.deliveryType === 'ONLINE' ? [{
                        OR: [
                          { zoomCreateLeaseOwner: null },
                          { zoomCreateLeaseExpiresAt: null },
                          { zoomCreateLeaseExpiresAt: { lt: new Date() } },
                        ],
                      }] : []),
                      ...(booking.zoomMeetingId ? [{
                        OR: [
                          { zoomSyncLeaseOwner: null },
                          { zoomSyncLeaseExpiresAt: null },
                          { zoomSyncLeaseExpiresAt: { lt: new Date() } },
                        ],
                      }] : []),
                    ],
                  },
                }
              : {}),
          }),
          tx.bookingStatusLog.create({
            data: {
              bookingId: cmd.bookingId,
              fromStatus: locked.status,
              toStatus: nextStatus,
              changedBy: cmd.changedBy,
              reason: 'rescheduled',
            },
          }),
          // Forward audit: the status-log row above cannot carry the old/new
          // times (it has no metadata column), so the reschedule renders as a
          // confusing same-status transition. Record a structured ActivityLog
          // entry the booking timeline surfaces as a RESCHEDULE event with the
          // actual time change. Same transaction → never orphaned.
          tx.activityLog.create({
            data: {
              userId: cmd.changedBy,
              action: ActivityAction.UPDATE,
              entity: 'Booking',
              entityId: cmd.bookingId,
              description: 'Booking rescheduled',
              metadata: {
                fromScheduledAt: locked.scheduledAt.toISOString(),
                toScheduledAt: newScheduledAt.toISOString(),
                durationMins,
              },
            },
          }),
        ];
        if (booking.zoomMeetingId && zoomSyncEventId && revision !== null) {
          const event = new BookingZoomRescheduleRequestedEvent({
            organizationId: DEFAULT_ORG_ID,
            syncId: zoomSyncEventId,
            bookingId: booking.id,
            zoomMeetingId: booking.zoomMeetingId,
            revision,
          }, zoomSyncEventId);
          writes.push(tx.bookingZoomSync.create({
            data: {
              id: zoomSyncEventId,
              eventId: zoomSyncEventId,
              bookingId: booking.id,
              sourceActionId: zoomSyncEventId,
              zoomMeetingId: booking.zoomMeetingId,
              desiredTopic: `Booking ${booking.id}`,
              desiredStartAt: newScheduledAt,
              desiredDurationMins: durationMins,
              revision,
            },
          }));
          writes.push(tx.outboxEvent.create({
            data: {
              id: event.eventId,
              aggregateId: booking.id,
              eventType: event.eventName,
              status: 'PENDING_V2',
              deliveryLane: 'PENDING_V2',
              payload: event.toEnvelope() as unknown as Prisma.InputJsonValue,
            },
          }));
        }
        return Promise.all(writes);
    }, { isolationLevel: 'Serializable' }), RESCHEDULE_TX_ATTEMPTS).catch(mapDbConflict) as [Awaited<ReturnType<typeof this.prisma.booking.update>>, ...unknown[]];

    return updated;
  }

  private async assertSlotAvailable(input: {
    bookingId: string;
    employeeId: string;
    branchId: string;
    serviceId: string;
    scheduledAt: Date;
    durationMins: number;
    durationOptionId?: string | null;
    bookingType: string;
    deliveryType: string;
  }) {
    const slots = await this.availabilityHandler.execute({
      employeeId: input.employeeId,
      branchId: input.branchId,
      serviceId: input.serviceId,
      date: input.scheduledAt,
      durationMins: input.durationMins,
      durationOptionId: input.durationOptionId,
      bookingType: input.bookingType,
      deliveryType: input.deliveryType as DeliveryType,
      excludeBookingId: input.bookingId,
    });

    const scheduledMs = input.scheduledAt.getTime();
    if (!slots.some((slot) => slot.startTime.getTime() === scheduledMs)) {
      throw new BadRequestException('Selected booking time is not available');
    }
  }
}
