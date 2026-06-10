import { Injectable } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface ClientInvoiceItem {
  id: string;
  number: number;
  bookingId: string | null;
  serviceName: string;
  scheduledAt: string | null;
  /** Integer halalas (1 SAR = 100). */
  subtotal: number;
  /** Integer halalas (1 SAR = 100). */
  discountAmt: number;
  vatRate: number;
  /** Integer halalas (1 SAR = 100). */
  vatAmt: number;
  /** Integer halalas (1 SAR = 100). */
  total: number;
  /** Integer halalas (1 SAR = 100). */
  refundedAmount: number;
  currency: string;
  status: string;
  paymentStatus: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface ListClientInvoicesResult {
  items: ClientInvoiceItem[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class ListClientInvoicesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(clientId: string, page = 1, pageSize = 20): Promise<ListClientInvoicesResult> {
    // Clamp pagination: this handler is reachable from the public /me endpoint
    // with raw query strings, so guard against huge/negative values here.
    const safePage = Math.max(1, Math.floor(Number(page)) || 1);
    const safePageSize = Math.min(100, Math.max(1, Math.floor(Number(pageSize)) || 20));
    const skip = (safePage - 1) * safePageSize;

    const where = { clientId, status: { not: InvoiceStatus.DRAFT } };

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: safePageSize,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    if (invoices.length === 0) {
      return { items: [], total, page: safePage, pageSize: safePageSize };
    }

    const bookingIds = [...new Set(invoices.map((i) => i.bookingId).filter((id): id is string => !!id))];
    const invoiceIds = invoices.map((i) => i.id);

    const [bookings, payments] = await Promise.all([
      bookingIds.length > 0
        ? this.prisma.booking.findMany({ where: { id: { in: bookingIds } } })
        : Promise.resolve([]),
      this.prisma.payment.findMany({
        where: { invoiceId: { in: invoiceIds } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const bookingsById = new Map(bookings.map((b) => [b.id, b]));
    // payments are ordered createdAt desc — first hit per invoice is the latest.
    const latestPaymentByInvoiceId = new Map<string, (typeof payments)[number]>();
    for (const payment of payments) {
      if (!latestPaymentByInvoiceId.has(payment.invoiceId)) {
        latestPaymentByInvoiceId.set(payment.invoiceId, payment);
      }
    }

    const items: ClientInvoiceItem[] = invoices.map((invoice) => {
      const booking = invoice.bookingId ? bookingsById.get(invoice.bookingId) : undefined;
      const payment = latestPaymentByInvoiceId.get(invoice.id);

      return {
        id: invoice.id,
        number: invoice.number,
        bookingId: invoice.bookingId,
        serviceName: booking?.serviceNameSnapshot ?? '',
        scheduledAt: booking?.scheduledAt?.toISOString() ?? null,
        subtotal: Number(invoice.subtotal),
        discountAmt: Number(invoice.discountAmt),
        vatRate: Number(invoice.vatRate),
        vatAmt: Number(invoice.vatAmt),
        total: Number(invoice.total),
        refundedAmount: Number(invoice.refundedAmount),
        currency: invoice.currency,
        status: invoice.status,
        paymentStatus: payment?.status ?? null,
        issuedAt: invoice.issuedAt?.toISOString() ?? null,
        paidAt: invoice.paidAt?.toISOString() ?? null,
        createdAt: invoice.createdAt.toISOString(),
      };
    });

    return { items, total, page: safePage, pageSize: safePageSize };
  }
}
