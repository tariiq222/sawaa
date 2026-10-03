import { Injectable, BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { fetchBookingOrFail, updateBookingAtomically } from '../booking-lifecycle.helper';
import { assertTransition } from '../booking-state-machine';
import { consumePackageCreditForBooking } from '../package-credit-consume.helper';
import { assertPackageCreditLifecycleAllowed } from '../package-credit-availability.helper';

export interface CheckInBookingCommand {
  bookingId: string;
  changedBy: string;
}

/** Receptionist marks client as arrived — preserves confirmation state with a checkedInAt timestamp. */
@Injectable()
export class CheckInBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(cmd: CheckInBookingCommand) {
    const booking = await fetchBookingOrFail(this.prisma, cmd.bookingId, [BookingStatus.CONFIRMED, BookingStatus.DEPOSIT_PAID], 'checked in');
    if (booking.checkedInAt) {
      throw new BadRequestException('Booking is already checked in');
    }
    const nextStatus = assertTransition(booking.status, 'CHECK_IN'); // Preserve DEPOSIT_PAID when balance remains due

    const updated = await this.rlsTransaction.withTransaction(async (tx) => {
      if (booking.packageCreditId) {
        // Lock the parent purchase before changing booking attendance so a
        // concurrent full refund cannot leave a refunded V2 session consumed.
        await assertPackageCreditLifecycleAllowed(tx, booking.packageCreditId);
      }
      // A plain `update` has no protection against a second concurrent
      // check-in (double-click, retry, two staff) that read the booking
      // before this one wrote — both would then consume the reserved
      // package credit. Gate the write on status + checkedInAt still being
      // null so a second racer's compare-and-swap affects zero rows and
      // fails deterministically instead of double-consuming.
      const updatedBooking = await updateBookingAtomically(tx, {
        bookingId: cmd.bookingId,
        currentStatus: booking.status,
        actionLabel: 'checked in',
        data: { checkedInAt: new Date() },
        extraWhere: { checkedInAt: null },
      });
      await tx.bookingStatusLog.create({
        data: {
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: nextStatus,
          changedBy: cmd.changedBy,
          reason: 'checked-in',
        },
      });

      // Attendance is what actually delivers a package session — consume the
      // reserved credit now rather than at booking time.
      if (booking.packageCreditId) {
        await consumePackageCreditForBooking(tx, cmd.bookingId);
      }

      return updatedBooking;
    });
    return updated;
  }
}
