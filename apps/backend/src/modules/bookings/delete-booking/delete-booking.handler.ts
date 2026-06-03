import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { isTerminalStatus } from '../booking-state-machine';

export interface DeleteBookingCommand {
  bookingId: string;
  changedBy: string;
}

/**
 * Hard-deletes a booking and its dependent records.
 *
 * Only permitted for terminal bookings (CANCELLED, COMPLETED, NO_SHOW,
 * EXPIRED) that carry no real money: a booking whose invoice has a payment in
 * COMPLETED, REFUNDED, or PENDING_VERIFICATION is rejected — cancel/refund it
 * first. Active bookings must be cancelled (state machine), never deleted.
 *
 * Cleanup runs in one transaction. Booking has no FK to Invoice/StatusLog/
 * Rating/IntakeResponse (cross-BC plain-string refs), so they are removed
 * explicitly; GroupEnrollment cascades via its FK. BundleUsage.bookingId is
 * nulled to preserve the bundle consumption record.
 */
@Injectable()
export class DeleteBookingHandler {
  private readonly logger = new Logger(DeleteBookingHandler.name);

  private static readonly BLOCKING_PAYMENT_STATUSES: PaymentStatus[] = [
    PaymentStatus.COMPLETED,
    PaymentStatus.REFUNDED,
    PaymentStatus.PENDING_VERIFICATION,
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(cmd: DeleteBookingCommand): Promise<void> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: cmd.bookingId },
      select: { id: true, status: true },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${cmd.bookingId} not found`);
    }

    if (!isTerminalStatus(booking.status)) {
      throw new BadRequestException(
        `Cannot delete a booking in status '${booking.status}'. ` +
          `Only terminal bookings (${[
            BookingStatus.CANCELLED,
            BookingStatus.COMPLETED,
            BookingStatus.NO_SHOW,
            BookingStatus.EXPIRED,
          ].join(', ')}) can be deleted. Cancel the booking instead.`,
      );
    }

    const blockingPayment = await this.prisma.payment.findFirst({
      where: {
        invoice: { bookingId: booking.id },
        status: { in: DeleteBookingHandler.BLOCKING_PAYMENT_STATUSES },
      },
      select: { id: true },
    });
    if (blockingPayment) {
      throw new BadRequestException(
        'Cannot delete a booking that has a paid or pending payment. ' +
          'Refund the payment first.',
      );
    }

    await this.rlsTransaction.withTransaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { bookingId: booking.id },
        select: { id: true },
      });
      if (invoice) {
        await tx.refundRequest.deleteMany({ where: { invoiceId: invoice.id } });
        await tx.payment.deleteMany({ where: { invoiceId: invoice.id } });
        await tx.invoice.delete({ where: { id: invoice.id } });
      }
      await tx.bookingStatusLog.deleteMany({ where: { bookingId: booking.id } });
      await tx.rating.deleteMany({ where: { bookingId: booking.id } });
      await tx.intakeResponse.deleteMany({ where: { bookingId: booking.id } });
      await tx.bundleUsage.updateMany({
        where: { bookingId: booking.id },
        data: { bookingId: null },
      });
      await tx.booking.delete({ where: { id: booking.id } });
    });

    this.logger.log(`Booking ${booking.id} hard-deleted by ${cmd.changedBy}`);
  }
}
