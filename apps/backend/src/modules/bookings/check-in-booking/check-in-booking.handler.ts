import { Injectable, BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { fetchBookingOrFail } from '../booking-lifecycle.helper';
import { assertTransition } from '../booking-state-machine';

export interface CheckInBookingCommand {
  bookingId: string;
  changedBy: string;
}

/** Receptionist marks client as arrived — transitions CONFIRMED → CONFIRMED with checkedInAt timestamp. */
@Injectable()
export class CheckInBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(cmd: CheckInBookingCommand) {
    const booking = await fetchBookingOrFail(this.prisma, cmd.bookingId, [BookingStatus.CONFIRMED], 'checked in');
    if (booking.checkedInAt) {
      throw new BadRequestException('Booking is already checked in');
    }
    const nextStatus = assertTransition(booking.status, 'CHECK_IN'); // CONFIRMED → CONFIRMED self-loop

    const [updated] = await this.rlsTransaction.withTransaction((tx) => Promise.all([
      tx.booking.update({
        where: { id: cmd.bookingId },
        data: { checkedInAt: new Date() },
      }),
      tx.bookingStatusLog.create({
        data: {
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: nextStatus,
          changedBy: cmd.changedBy,
          reason: 'checked-in',
        },
      }),
    ]));
    return updated;
  }
}
