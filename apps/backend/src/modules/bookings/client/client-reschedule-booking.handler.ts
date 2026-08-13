import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { DeliveryType, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { ClientRescheduleBookingDto } from './client-reschedule-booking.dto';
import { CheckAvailabilityHandler } from '../check-availability/check-availability.handler';
import { ZoomMeetingService } from '../zoom-meeting.service';
import { DEFAULT_ORG_ID } from '../../../common/constants';
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
  /** Must be invoked only after an externally supplied transaction commits. */
  postCommit?: () => Promise<void>;
};

@Injectable()
export class ClientRescheduleBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly settingsHandler: GetBookingSettingsHandler,
    private readonly zoomMeetingService: ZoomMeetingService,
    private readonly availabilityHandler: CheckAvailabilityHandler,
  ) {}

  async execute(cmd: ClientRescheduleCommand): Promise<RescheduleResult> {
    const newScheduledAt = new Date(cmd.newScheduledAt);
    if (Number.isNaN(newScheduledAt.getTime())) {
      throw new BadRequestException('New scheduled time must be in the future');
    }
    const actionHash = this.actionHash(cmd, newScheduledAt);

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

      const updated = await updateBookingAtomically(tx, {
        bookingId: cmd.bookingId,
        currentStatus: booking.status,
        actionLabel: 'rescheduled',
        data: { scheduledAt: newScheduledAt, endsAt: newEndsAt, durationMins },
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

      const postCommit = booking.zoomMeetingId
        ? async () => {
            await this.zoomMeetingService.updateMeeting(DEFAULT_ORG_ID, booking.zoomMeetingId!, {
              topic: `Booking ${booking.id}`,
              startTime: newScheduledAt.toISOString(),
              durationMins,
            }).catch(() => {});
          }
        : undefined;
      return { booking: updated, postCommit };
    };

    const result = cmd.transaction
      ? await mutate(cmd.transaction)
      : await this.rlsTransaction.withTransaction(mutate, { isolationLevel: 'Serializable' });
    if (!cmd.transaction && result.postCommit) await result.postCommit();
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
