import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { CancelBookingHandler } from '../cancel-booking/cancel-booking.handler';
import { VALID_TRANSITIONS } from '../booking-state-machine';
import type { CancelRecurringSeriesDto } from './cancel-recurring-series.dto';

export type CancelRecurringSeriesCommand = CancelRecurringSeriesDto & {
  changedBy: string;
};

/**
 * Statuses from which a DIRECT_CANCEL transition is valid.
 * Derived from the state machine — single source of truth.
 */
const CANCELLABLE_STATUSES = VALID_TRANSITIONS.DIRECT_CANCEL.from;

@Injectable()
export class CancelRecurringSeriesHandler {
  private readonly logger = new Logger(CancelRecurringSeriesHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cancelBooking: CancelBookingHandler,
  ) {}

  async execute(cmd: CancelRecurringSeriesCommand): Promise<{ cancelled: number; skipped: number }> {
    const where: Prisma.BookingWhereInput = {
      recurringGroupId: cmd.recurringGroupId,
      status: { in: CANCELLABLE_STATUSES },
    };

    if (cmd.fromDate) {
      where.scheduledAt = { gte: new Date(cmd.fromDate) };
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      select: { id: true },
      orderBy: { scheduledAt: 'asc' },
    });

    if (bookings.length === 0) {
      throw new NotFoundException(`No cancellable bookings found for recurringGroupId ${cmd.recurringGroupId}`);
    }

    let cancelled = 0;
    let skipped = 0;

    for (const { id } of bookings) {
      try {
        await this.cancelBooking.execute({
          bookingId: id,
          changedBy: cmd.changedBy,
          reason: cmd.reason,
          cancelNotes: cmd.cancelNotes,
        });
        cancelled++;
      } catch (err) {
        this.logger.warn(`Skipped booking ${id} during recurring cancel: ${(err as Error).message}`);
        skipped++;
      }
    }

    return { cancelled, skipped };
  }
}
