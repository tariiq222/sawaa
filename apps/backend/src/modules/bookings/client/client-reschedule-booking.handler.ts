import { Injectable, BadRequestException, ForbiddenException, ConflictException, Optional } from '@nestjs/common';
import type { DeliveryType } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { ClientRescheduleBookingDto } from './client-reschedule-booking.dto';
import { CheckAvailabilityHandler } from '../check-availability/check-availability.handler';
import { assertTransition } from '../booking-state-machine';
import { STAFF_TIME_BLOCKING_BOOKING_STATUSES } from '../active-booking-statuses';
import { updateBookingAtomically, hashToInt32 } from '../booking-lifecycle.helper';

export type ClientRescheduleCommand = ClientRescheduleBookingDto & {
  bookingId: string;
  clientId: string;
};

@Injectable()
export class ClientRescheduleBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly settingsHandler: GetBookingSettingsHandler,
    @Optional() private readonly availabilityHandler?: CheckAvailabilityHandler,
  ) {}

  async execute(cmd: ClientRescheduleCommand) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: cmd.bookingId },
    });

    if (!booking) {
      throw new BadRequestException(`Booking ${cmd.bookingId} not found`);
    }

    if (booking.clientId !== cmd.clientId) {
      throw new ForbiddenException('You do not own this booking');
    }

    // RESCHEDULE self-loop: validates status is PENDING or CONFIRMED, returns same status
    const nextStatus = assertTransition(booking.status, 'RESCHEDULE');

    const newScheduledAt = new Date(cmd.newScheduledAt);
    if (newScheduledAt <= new Date()) {
      throw new BadRequestException('New scheduled time must be in the future');
    }

    const settings = await this.settingsHandler.execute({ branchId: booking.branchId });
    const hoursUntilBooking = (booking.scheduledAt.getTime() - Date.now()) / 3_600_000;

    if (hoursUntilBooking < settings.clientRescheduleMinHoursBefore) {
      throw new BadRequestException(
        `Rescheduling is only allowed at least ${settings.clientRescheduleMinHoursBefore} hours before the appointment. Please contact the clinic to reschedule.`,
      );
    }

    // NOTE: prior to unification, client reschedules were written with reason
    // 'CLIENT_RESCHEDULE'. Existing rows with that value will no longer be
    // counted after this change. This only under-counts for pre-existing
    // bookings and is not a security regression (it may allow one extra
    // reschedule on legacy bookings, which is acceptable).
    const rescheduleCount = await this.prisma.bookingStatusLog.count({
      where: { bookingId: cmd.bookingId, reason: 'rescheduled' },
    });
    if (rescheduleCount >= settings.maxReschedulesPerBooking) {
      throw new BadRequestException(
        `Maximum reschedules (${settings.maxReschedulesPerBooking}) reached for this booking`,
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

    const [updated] = await this.rlsTransaction.withTransaction(
      async (tx) => {
        // Parity with reschedule-booking handler (CR-5): acquire an advisory
        // lock scoped to employee + new slot window BEFORE the conflict check
        // to prevent TOCTOU double-booking races on concurrent reschedules.
        const lockKey1 = hashToInt32(`${booking.employeeId}`);
        const lockKey2 = hashToInt32(`${newScheduledAt.toISOString()}:${newEndsAt.toISOString()}`);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey1}::int, ${lockKey2}::int)`;

        // Parity with reschedule-booking handler: respect the branch
        // bufferMinutes when checking for overlaps so a rescheduled booking
        // cannot land inside another booking's buffer window.
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

        return Promise.all([
          updateBookingAtomically(tx, {
            bookingId: cmd.bookingId,
            currentStatus: booking.status,
            actionLabel: 'rescheduled',
            data: { scheduledAt: newScheduledAt, endsAt: newEndsAt, durationMins },
          }),
          tx.bookingStatusLog.create({
            data: {
              bookingId: cmd.bookingId,
              fromStatus: booking.status,
              toStatus: nextStatus,
              changedBy: cmd.clientId,
              // Unified reason across all reschedule channels (staff + client)
              // so the limit-enforcement count query covers all reschedules.
              reason: 'rescheduled',
            },
          }),
        ]);
      },
      { isolationLevel: 'Serializable' },
    );

    return { booking: updated };
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
    if (!this.availabilityHandler) return;

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
