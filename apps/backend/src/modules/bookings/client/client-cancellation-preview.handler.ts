import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../../infrastructure/database';
import { GetBookingSettingsHandler } from '../get-booking-settings/get-booking-settings.handler';
import { calculateClientCancellation, type ClientCancellationSettings, type ClientCancellationPreview } from './client-cancellation-policy';

export async function readCancellationPayments(tx: Prisma.TransactionClient, bookingId: string, lock = false) {
  if (lock) {
    // Match finance's invoice -> payment lock order, including every capture.
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Invoice" WHERE "bookingId" = ${bookingId} ORDER BY "id" FOR UPDATE`);
    await tx.$queryRaw(Prisma.sql`SELECT p."id" FROM "Payment" p JOIN "Invoice" i ON i."id" = p."invoiceId" WHERE i."bookingId" = ${bookingId} ORDER BY p."id" FOR UPDATE OF p`);
  }
  return tx.payment.findMany({
    where: { invoice: { bookingId }, status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'] } },
    orderBy: { id: 'asc' },
    include: { refundRequests: { orderBy: { id: 'asc' }, select: { id: true, amount: true, status: true } } },
  });
}

@Injectable()
export class ClientCancellationPreviewHandler {
  constructor(private readonly rls: RlsTransactionService, private readonly settings: GetBookingSettingsHandler) {}

  async execute(bookingId: string, clientId: string): Promise<ClientCancellationPreview> {
    return this.rls.withTransaction(async tx => {
      const booking = await tx.booking.findFirst({ where: { id: bookingId, clientId } });
      if (!booking) throw new NotFoundException('Booking not found');
      const settings = await this.settings.execute({ branchId: booking.branchId, transaction: tx });
      const payments = await readCancellationPayments(tx, booking.id);
      const { allocations: _allocations, ...preview } = calculateClientCancellation(booking, settings as ClientCancellationSettings, payments);
      return preview;
    }, { isolationLevel: 'Serializable' });
  }
}
