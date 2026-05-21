import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { fetchBookingOrFail } from '../booking-lifecycle.helper';
import { assertTransition } from '../booking-state-machine';

export interface ExpireBookingCommand {
  bookingId: string;
  changedBy: string;
}

@Injectable()
export class ExpireBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(cmd: ExpireBookingCommand) {
    const booking = await fetchBookingOrFail(
      this.prisma,
      cmd.bookingId,
      [BookingStatus.PENDING, BookingStatus.PENDING_GROUP_FILL, BookingStatus.AWAITING_PAYMENT],
      'expired',
    );
    const nextStatus = assertTransition(booking.status, 'EXPIRE');

    const [updated] = await this.rlsTransaction.withTransaction((tx) => Promise.all([
      tx.booking.update({
        where: { id: cmd.bookingId },
        data: { status: nextStatus, expiresAt: new Date() },
      }),
      tx.bookingStatusLog.create({
        data: {
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: nextStatus,
          changedBy: cmd.changedBy,
        },
      }),
    ]));
    return updated;
  }
}
