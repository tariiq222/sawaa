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

/** Client-safe payment row: no gateway refs, idempotency keys, receipt paths or audit fields. */
export interface GetClientInvoicePayment {
  id: string;
  number: number;
  amount: number;
  refundedAmount: number;
  currency: string;
  method: string;
  status: string;
  createdAt: string;
  processedAt: string | null;
}

/**
 * The single client invoice read shared by the website (`/public/invoices/:id`)
 * and the app (`/mobile/client/payments/invoices/:id`): the union of both
 * channels' fields minus staff-only data (notes, discount audit, pdf keys,
 * sentToClientAt, receipt audit ids).
 */
export interface GetClientInvoiceResult extends GetPublicInvoiceResult {
  number: number;
  payments: GetClientInvoicePayment[];
}

@Injectable()
export class GetPublicInvoiceHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(invoiceId: string, clientId: string): Promise<GetClientInvoiceResult> {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        clientId: clientId,
      },
      include: {
        payments: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            number: true,
            amount: true,
            refundedAmount: true,
            currency: true,
            method: true,
            status: true,
            createdAt: true,
            processedAt: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    const sellerName = await resolveInvoiceSellerName(this.prisma);

    return {
      ...mapInvoiceResult(invoice, sellerName),
      number: invoice.number,
      payments: invoice.payments.map((p) => ({
        id: p.id,
        number: p.number,
        amount: Number(p.amount),
        refundedAmount: Number(p.refundedAmount),
        currency: p.currency,
        method: p.method,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        processedAt: p.processedAt?.toISOString() ?? null,
      })),
    };
  }
}
