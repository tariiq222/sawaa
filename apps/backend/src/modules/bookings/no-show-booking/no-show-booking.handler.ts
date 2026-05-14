import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { fetchBookingOrFail } from '../booking-lifecycle.helper';

export interface NoShowBookingCommand {
  bookingId: string;
  changedBy: string;
}

@Injectable()
export class NoShowBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: NoShowBookingCommand) {
    const booking = await fetchBookingOrFail(this.prisma, cmd.bookingId, [BookingStatus.CONFIRMED], 'marked as no-show');

    const [updated] = await this.prisma.$transaction((tx) => Promise.all([
      tx.booking.update({
        where: { id: cmd.bookingId },
        data: { status: BookingStatus.NO_SHOW, noShowAt: new Date() },
      }),
      tx.bookingStatusLog.create({
        data: {
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: BookingStatus.NO_SHOW,
          changedBy: cmd.changedBy,
        },
      }),
    ]));
    return updated;
  }
}
