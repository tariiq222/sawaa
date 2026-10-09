import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import type { GetPublicInvoiceResult } from './get-public-invoice.handler';
import { resolveInvoiceSellerName } from './invoice-seller-name';
import { mapInvoiceResult } from './invoice-result.mapper';

@Injectable()
export class GetBookingInvoiceHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(bookingId: string, clientId: string): Promise<GetPublicInvoiceResult> {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        bookingId,
        clientId,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice for booking ${bookingId} not found`);
    }

    const sellerName = await resolveInvoiceSellerName(this.prisma);

    return mapInvoiceResult(invoice, sellerName);
  }
}
