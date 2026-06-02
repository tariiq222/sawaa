import { Injectable, BadRequestException, ConflictException, ForbiddenException, Optional } from '@nestjs/common';
import { BookingStatus, Prisma, type DeliveryType } from '@prisma/client';

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
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { RescheduleBookingDto } from './reschedule-booking.dto';
import { fetchBookingOrFail } from '../booking-lifecycle.helper';
import { ZoomMeetingService } from '../zoom-meeting.service';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { CheckAvailabilityHandler } from '../check-availability/check-availability.handler';
import { assertTransition } from '../booking-state-machine';

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
    private readonly zoomMeetingService: ZoomMeetingService,
    @Optional() private readonly availabilityHandler?: CheckAvailabilityHandler,
  ) {}

  async execute(cmd: RescheduleBookingCommand) {
    const booking = await fetchBookingOrFail(this.prisma, cmd.bookingId, [BookingStatus.PENDING, BookingStatus.CONFIRMED], 'rescheduled');
    // RESCHEDULE is a self-loop: status stays the same (PENDING or CONFIRMED)
    const nextStatus = assertTransition(booking.status, 'RESCHEDULE');
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
      serviceId: booking.serviceId,
      scheduledAt: newScheduledAt,
      durationMins,
      durationOptionId: booking.durationOptionId,
      bookingType: booking.bookingType,
      deliveryType: booking.deliveryType,
    });

    // Serialize conflict check + update + status log inside one transaction.
    const [updated] = await this.rlsTransaction.withTransaction(async (tx) => {
        const conflict = await tx.booking.findFirst({
          where: {
            employeeId: booking.employeeId,
            id: { not: cmd.bookingId },
            status: { in: ['PENDING', 'CONFIRMED', 'AWAITING_PAYMENT'] },
            scheduledAt: { lt: newEndsAt },
            endsAt: { gt: newScheduledAt },
          },
          select: { id: true },
        });
        if (conflict) {
          throw new ConflictException('Employee already has a booking in the new time slot');
        }

        return Promise.all([
          tx.booking.update({
            where: { id: cmd.bookingId },
            data: { scheduledAt: newScheduledAt, endsAt: newEndsAt, durationMins },
          }),
          tx.bookingStatusLog.create({
            data: {
              bookingId: cmd.bookingId,
              fromStatus: booking.status,
              toStatus: nextStatus,
              changedBy: cmd.changedBy,
              reason: 'rescheduled',
            },
          }),
        ]);
    }, { isolationLevel: 'Serializable' }).catch(mapDbConflict) as [Awaited<ReturnType<typeof this.prisma.booking.update>>, unknown];

    if (booking.zoomMeetingId) {
      // Best effort update — only for ONLINE delivery type bookings
      this.zoomMeetingService
        .updateMeeting(DEFAULT_ORG_ID, booking.zoomMeetingId, {
          topic: `Booking ${booking.id}`,
          startTime: newScheduledAt.toISOString(),
          durationMins,
        })
        .catch(() => {});
    }

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
