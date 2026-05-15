import { Injectable } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { CompleteBookingDto } from './complete-booking.dto';
import { fetchBookingOrFail } from '../booking-lifecycle.helper';

export type CompleteBookingCommand = CompleteBookingDto & {
  bookingId: string;
  changedBy: string;
};

@Injectable()
export class CompleteBookingHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: CompleteBookingCommand) {
    const booking = await fetchBookingOrFail(this.prisma, cmd.bookingId, [BookingStatus.CONFIRMED], 'completed');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: cmd.bookingId },
        data: {
          status: BookingStatus.COMPLETED,
          completedAt: new Date(),
          ...(cmd.completionNotes && { notes: cmd.completionNotes }),
        },
      });

      await tx.bookingStatusLog.create({
        data: {
          bookingId: cmd.bookingId,
          fromStatus: booking.status,
          toStatus: BookingStatus.COMPLETED,
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
          const subtotalDec = new Prisma.Decimal((booking.discountedPrice ?? booking.price).toString());
          const vatAmt = subtotalDec.mul(vatRateDec).toDecimalPlaces(2).toNumber();
          const total = subtotalDec.add(subtotalDec.mul(vatRateDec)).toDecimalPlaces(2).toNumber();
          await tx.invoice.create({
            data: {
              branchId: booking.branchId,
              clientId: booking.clientId,
              employeeId: booking.employeeId,
              bookingId: booking.id,
              subtotal: subtotalDec.toNumber(),
              vatRate: vatRateDec.toNumber(),
              vatAmt,
              total,
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
