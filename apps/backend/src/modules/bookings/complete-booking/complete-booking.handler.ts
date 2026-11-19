import { Injectable } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService, TransactionService } from '../../../infrastructure/database';
import { CompleteBookingDto } from './complete-booking.dto';
import { fetchBookingOrFail, updateBookingAtomically } from '../booking-lifecycle.helper';
import { assertTransition } from '../booking-state-machine';
import { BookingFinanceLedgerService } from '../../finance/booking-finance/booking-finance-ledger.service';
import {
  consumePackageCreditForBooking,
  markPackageCreditDeliveredForBooking,
} from '../package-credit-consume.helper';
import { assertPackageCreditLifecycleAllowed } from '../package-credit-availability.helper';

export type CompleteBookingCommand = CompleteBookingDto & {
  bookingId: string;
  changedBy: string;
};

@Injectable()
export class CompleteBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: TransactionService,
    private readonly financeLedger: BookingFinanceLedgerService,
  ) {}

  async execute(cmd: CompleteBookingCommand) {
    const booking = await fetchBookingOrFail(this.prisma, cmd.bookingId, [BookingStatus.CONFIRMED, BookingStatus.DEPOSIT_PAID], 'completed');
    const nextStatus = assertTransition(booking.status, 'COMPLETE');

    return this.rlsTransaction.withTransaction(async (tx) => {
      if (booking.packageCreditId) {
        await assertPackageCreditLifecycleAllowed(tx, booking.packageCreditId);
      }
      const updated = await updateBookingAtomically(tx, {
        bookingId: cmd.bookingId,
        currentStatus: booking.status,
        actionLabel: 'completed',
        data: {
          status: nextStatus,
          completedAt: new Date(),
          ...(cmd.completionNotes && { notes: cmd.completionNotes }),
        },
      });

      await tx.bookingStatusLog.create({
        data: {
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: nextStatus,
          changedBy: cmd.changedBy,
        },
      });

      // Safety net: a booking completed without a check-in still delivered the
      // session. consumePackageCreditForBooking is scoped to RESERVED, so a
      // booking that already consumed at check-in is a no-op here.
      if (booking.packageCreditId) {
        await consumePackageCreditForBooking(tx, cmd.bookingId);
        // Check-in consumes the seat but does not prove delivery. Completion
        // stamps the active V2 usage, idempotently, for sequence gating.
        await markPackageCreditDeliveredForBooking(tx, cmd.bookingId);
      }

      if (booking.payAtClinic) {
        // payAtClinic bookings have no invoice until completion. The ledger
        // service keeps the silent no-op when one already exists and applies
        // the same VAT rules as every other booking invoice.
        await this.financeLedger.ensureBookingInvoiceInTx(tx, {
          bookingId: booking.id,
          branchId: booking.branchId,
          clientId: booking.clientId,
          employeeId: booking.employeeId,
          subtotal: new Prisma.Decimal(
            (booking.discountedPrice ?? booking.price).toString(),
          ),
          issueMode: 'ISSUED',
          issuedAt: new Date(),
        });
      }

      return updated;
    });
  }
}
