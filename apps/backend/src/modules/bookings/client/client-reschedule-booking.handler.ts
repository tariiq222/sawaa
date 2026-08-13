import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { DeliveryType, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { ClientRescheduleBookingDto } from './client-reschedule-booking.dto';
import { CheckAvailabilityHandler } from '../check-availability/check-availability.handler';
import { ZoomMeetingService } from '../zoom-meeting.service';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { stableEventId } from '../../../common/events';
import { BookingZoomRescheduleRequestedEvent } from '../events/booking-zoom-reschedule-requested.event';
import { assertTransition } from '../booking-state-machine';
import {
  ACTIVE_BOOKING_STATUSES,
  STAFF_TIME_BLOCKING_BOOKING_STATUSES,
} from '../active-booking-statuses';
import {
  assertBookingIsMutable,
  hashToInt32,
  updateBookingAtomically,
} from '../booking-lifecycle.helper';

export type ClientRescheduleCommand = ClientRescheduleBookingDto & {
  bookingId: string;
  clientId: string;
  sourceActionId?: string;
  transaction?: Prisma.TransactionClient;
};

type RescheduleResult = {
  booking: Awaited<ReturnType<typeof updateBookingAtomically>>;
};

@Injectable()
export class ClientRescheduleBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly settingsHandler: GetBookingSettingsHandler,
    _zoomMeetingService: ZoomMeetingService,
    private readonly availabilityHandler: CheckAvailabilityHandler,
  ) {}

  async execute(cmd: ClientRescheduleCommand): Promise<RescheduleResult> {
    const newScheduledAt = new Date(cmd.newScheduledAt);
    if (Number.isNaN(newScheduledAt.getTime())) {
      throw new BadRequestException('New scheduled time must be in the future');
    }
    const actionHash = this.actionHash(cmd, newScheduledAt);
    const zoomSyncEventId = cmd.sourceActionId
      ? stableEventId(`booking:${cmd.bookingId}:zoom-reschedule:${cmd.sourceActionId}`)
      : randomUUID();

    const mutate = async (tx: Prisma.TransactionClient): Promise<RescheduleResult> => {
      // Global booking lock order: client, then employee/slot, then booking mutation.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${hashToInt32('client_booking')}::int, ${hashToInt32(cmd.clientId)}::int)`;

      const booking = await tx.booking.findUnique({ where: { id: cmd.bookingId } });
      if (!booking) throw new BadRequestException(`Booking ${cmd.bookingId} not found`);
      if (booking.clientId !== cmd.clientId) throw new ForbiddenException('You do not own this booking');
      assertBookingIsMutable(booking);

      if (cmd.sourceActionId) {
        const previous = await tx.bookingStatusLog.findUnique({
          where: { sourceActionId: cmd.sourceActionId },
        });
        if (previous) {
          if (previous.sourceActionHash !== actionHash || previous.bookingId !== cmd.bookingId) {
            throw new ConflictException('Action id was already used with different reschedule data');
          }
          return { booking };
        }
      }

      if (newScheduledAt <= new Date()) {
        throw new BadRequestException('New scheduled time must be in the future');
      }

      const nextStatus = assertTransition(booking.status, 'RESCHEDULE');
      const settings = await this.settingsHandler.execute({
        branchId: booking.branchId,
        transaction: tx,
      });
      const hoursUntilBooking = (booking.scheduledAt.getTime() - Date.now()) / 3_600_000;
      if (hoursUntilBooking < settings.clientRescheduleMinHoursBefore) {
        throw new BadRequestException(
          `Rescheduling is only allowed at least ${settings.clientRescheduleMinHoursBefore} hours before the appointment. Please contact the clinic to reschedule.`,
        );
      }

      const rescheduleCount = await tx.bookingStatusLog.count({
        where: { bookingId: cmd.bookingId, reason: 'rescheduled' },
      });
      if (rescheduleCount >= settings.maxReschedulesPerBooking) {
        throw new BadRequestException(
          `Maximum reschedules (${settings.maxReschedulesPerBooking}) reached for this booking`,
        );
      }

      // Client reschedules never accept a new duration; the stored booking duration is immutable here.
      const durationMins = booking.durationMins;
      const newEndsAt = new Date(newScheduledAt.getTime() + durationMins * 60_000);
      const employeeLockKey = hashToInt32(`${booking.employeeId}`);
      const slotLockKey = hashToInt32(`${newScheduledAt.toISOString()}:${newEndsAt.toISOString()}`);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${employeeLockKey}::int, ${slotLockKey}::int)`;

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
        transaction: tx,
      });

      const clientConflict = await tx.booking.findFirst({
        where: {
          clientId: cmd.clientId,
          id: { not: cmd.bookingId },
          status: { in: [...ACTIVE_BOOKING_STATUSES] },
          isHistoricalImport: false,
          scheduledAt: { lt: newEndsAt },
          endsAt: { gt: newScheduledAt },
        },
        select: { id: true },
      });
      if (clientConflict) throw new ConflictException('Client already has an overlapping appointment');

      const bufferMs = (settings.bufferMinutes ?? 0) * 60_000;
      const conflict = await tx.booking.findFirst({
        where: {
          employeeId: booking.employeeId,
          id: { not: cmd.bookingId },
          status: { in: [...STAFF_TIME_BLOCKING_BOOKING_STATUSES] },
          scheduledAt: { lt: new Date(newEndsAt.getTime() + bufferMs) },
          endsAt: { gt: new Date(newScheduledAt.getTime() - bufferMs) },
        },
        select: { id: true },
      });
      if (conflict) throw new ConflictException('Employee already has a booking in the new time slot');

      const providerLeaseGuards: Record<string, unknown>[] = [];
      if (booking.zoomMeetingId) {
        providerLeaseGuards.push({
          OR: [
            { zoomSyncLeaseOwner: null },
            { zoomSyncLeaseExpiresAt: { lt: new Date() } },
          ],
        });
      }
      if (booking.deliveryType === 'ONLINE') {
        providerLeaseGuards.push({
          OR: [
            { zoomCreateLeaseOwner: null },
            { zoomCreateLeaseExpiresAt: { lt: new Date() } },
          ],
        });
      }

      const updated = await updateBookingAtomically(tx, {
        bookingId: cmd.bookingId,
        currentStatus: booking.status,
        actionLabel: 'rescheduled',
        data: {
          scheduledAt: newScheduledAt,
          endsAt: newEndsAt,
          durationMins,
          ...(booking.zoomMeetingId
            ? { zoomSyncRevision: (booking.zoomSyncRevision ?? 0) + 1 }
            : {}),
        },
        ...(providerLeaseGuards.length > 0
          ? {
              // Create and reschedule provider workers both own booking-scoped
              // leases. A new desired time lands only after every relevant
              // lease is released/expired, so an older provider call cannot
              // race the newly committed schedule.
              extraWhere: { AND: providerLeaseGuards },
            }
          : {}),
      });
      await tx.bookingStatusLog.create({
        data: {
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: nextStatus,
          changedBy: cmd.clientId,
          reason: 'rescheduled',
          sourceActionId: cmd.sourceActionId,
          sourceActionHash: cmd.sourceActionId ? actionHash : undefined,
          sourceActionResult: cmd.sourceActionId
            ? {
                kind: 'RESCHEDULE',
                bookingId: cmd.bookingId,
                scheduledAt: newScheduledAt.toISOString(),
                endsAt: newEndsAt.toISOString(),
                durationMins,
              }
            : undefined,
        },
      });

      if (booking.zoomMeetingId) {
        const revision = (booking.zoomSyncRevision ?? 0) + 1;
        const sourceActionId = cmd.sourceActionId ?? zoomSyncEventId;
        await tx.bookingZoomSync.create({
          data: {
            id: zoomSyncEventId,
            eventId: zoomSyncEventId,
            bookingId: booking.id,
            sourceActionId,
            zoomMeetingId: booking.zoomMeetingId,
            desiredTopic: `Booking ${booking.id}`,
            desiredStartAt: newScheduledAt,
            desiredDurationMins: durationMins,
            revision,
          },
        });
        const event = new BookingZoomRescheduleRequestedEvent({
          organizationId: DEFAULT_ORG_ID,
          syncId: zoomSyncEventId,
          bookingId: booking.id,
          zoomMeetingId: booking.zoomMeetingId,
          revision,
        }, zoomSyncEventId);
        await tx.outboxEvent.create({
          data: {
            id: event.eventId,
            aggregateId: booking.id,
            eventType: event.eventName,
            status: 'PENDING_V2',
            deliveryLane: 'PENDING_V2',
            payload: event.toEnvelope() as unknown as Prisma.InputJsonValue,
          },
        });
      }
      return { booking: updated };
    };

    const result = cmd.transaction
      ? await mutate(cmd.transaction)
      : await this.rlsTransaction.withTransaction(mutate, { isolationLevel: 'Serializable' });
    return cmd.transaction ? result : { booking: result.booking };
  }

  private actionHash(cmd: ClientRescheduleCommand, scheduledAt: Date): string {
    return createHash('sha256')
      .update(JSON.stringify({
        action: 'CLIENT_RESCHEDULE',
        bookingId: cmd.bookingId,
        clientId: cmd.clientId,
        scheduledAt: scheduledAt.toISOString(),
      }))
      .digest('hex');
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
    transaction: Prisma.TransactionClient;
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
      transaction: input.transaction,
    });
    if (!slots.some((slot) => slot.startTime.getTime() === input.scheduledAt.getTime())) {
      throw new BadRequestException('Selected booking time is not available');
    }
  }
}
