import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { resolveInvoiceSellerName } from './invoice-seller-name';
import { mapInvoiceResult } from './invoice-result.mapper';

export interface GetPublicInvoiceResult {
  id: string;
  sellerName: string;
  branchId: string;
  clientId: string;
  employeeId: string;
  bookingId: string | null;
  packagePurchaseId: string | null;
  subtotal: number;
  discountAmt: number;
  vatRate: number;
  vatAmt: number;
  total: number;
  refundedAmount: number;
  refundedVatAmt: number;
  currency: string;
  status: string;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
  pdfUrl: string | null;
}

@Injectable()
export class GetPublicInvoiceHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(invoiceId: string, clientId: string): Promise<GetPublicInvoiceResult> {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        clientId: clientId,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    const sellerName = await resolveInvoiceSellerName(this.prisma);

    return mapInvoiceResult(invoice, sellerName);
  }
}
