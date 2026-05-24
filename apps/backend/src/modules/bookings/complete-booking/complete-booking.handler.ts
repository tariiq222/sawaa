import { Injectable } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CompleteBookingDto } from './complete-booking.dto';
import { fetchBookingOrFail } from '../booking-lifecycle.helper';
import { assertTransition } from '../booking-state-machine';
import { computeVat } from '../../finance/money.helper';

export type CompleteBookingCommand = CompleteBookingDto & {
  bookingId: string;
  changedBy: string;
};

@Injectable()
export class CompleteBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(cmd: CompleteBookingCommand) {
    const booking = await fetchBookingOrFail(this.prisma, cmd.bookingId, [BookingStatus.CONFIRMED], 'completed');
    const nextStatus = assertTransition(booking.status, 'COMPLETE');

    return this.rlsTransaction.withTransaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: cmd.bookingId },
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

      // payAtClinic bookings have no invoice yet (create-booking.handler.ts skips it
      // for payAtClinic). Create one now at completion time so the financial trail
      // is complete. We use findUnique on bookingId to silently no-op if an invoice
      // somehow already exists.
      if (booking.payAtClinic) {
        const existing = await tx.invoice.findUnique({ where: { bookingId: booking.id } });
        if (!existing) {
          const orgSettings = await tx.organizationSettings.findFirst({
            where: {},
            select: { vatRate: true },
          });
          const vatRateDec = new Prisma.Decimal(orgSettings?.vatRate?.toString() ?? '0.15');
          const subtotalDec = new Prisma.Decimal(
            (booking.discountedPrice ?? booking.price).toString(),
          );
          const { vatAmtHalalas, totalHalalas } = computeVat(subtotalDec, vatRateDec);
          await tx.invoice.create({
            data: {
              branchId: booking.branchId,
              clientId: booking.clientId,
              employeeId: booking.employeeId,
              bookingId: booking.id,
              subtotal: subtotalDec,
              vatRate: vatRateDec,
              vatAmt: vatAmtHalalas,
              total: totalHalalas,
              currency: booking.currency,
              status: 'ISSUED',
              issuedAt: new Date(),
            },
          });
        }
      }

      return updated;
    });
  }
}
