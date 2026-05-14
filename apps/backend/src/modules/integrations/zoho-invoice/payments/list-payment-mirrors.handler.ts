import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../../common/tenant';
import { PrismaService } from '../../../../infrastructure/database';
import { DEFAULT_ORGANIZATION_ID } from "../../../../common/tenant/tenant.constants";

interface ListPaymentMirrorsQuery {
  page: number;
  perPage: number;
  clientId?: string;
}

/**
 * Returns Payment rows for the current tenant joined with their Zoho mirror
 * status (scope=TENANT_CLIENT). Used by the dashboard to render a "Zoho
 * receipt" link next to each captured payment so clinic staff can hand a
 * formatted invoice URL/PDF to the client without leaving the dashboard.
 *
 * The Zoho link is matched by the local Invoice id, NOT by the payment id —
 * one Zoho invoice mirrors one Deqah invoice, but a Deqah invoice may have
 * multiple Payment rows (split payments).
 */
@Injectable()
export class ListPaymentMirrorsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(q: ListPaymentMirrorsQuery) {
    const organizationId = DEFAULT_ORGANIZATION_ID;
    const where: Record<string, unknown> = { organizationId, status: 'COMPLETED' };

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { processedAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        select: {
          id: true,
          amount: true,
          currency: true,
          method: true,
          gatewayRef: true,
          processedAt: true,
          createdAt: true,
          invoiceId: true,
          invoice: {
            select: {
              id: true,
              clientId: true,
              bookingId: true,
              total: true,
            },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    if (payments.length === 0) {
      return {
        items: [],
        meta: { page: q.page, perPage: q.perPage, total, totalPages: 1 },
      };
    }

    const invoiceIds = payments.map((p) => p.invoiceId);
    const mirrors = await this.prisma.zohoInvoiceLink.findMany({
      where: {
        scope: 'TENANT_CLIENT',
        deqahInvoiceId: { in: invoiceIds },
      },
      select: {
        deqahInvoiceId: true,
        zohoInvoiceId: true,
        status: true,
        invoiceUrl: true,
        pdfUrl: true,
        viewedAt: true,
        lastSentAt: true,
        createdAt: true,
      },
    });
    const byInvoice = new Map(mirrors.map((m) => [m.deqahInvoiceId!, m]));

    let filtered = payments;
    if (q.clientId) {
      filtered = payments.filter((p) => p.invoice.clientId === q.clientId);
    }

    return {
      items: filtered.map((p) => ({
        paymentId: p.id,
        amount: p.amount,
        currency: p.currency,
        method: p.method,
        gatewayRef: p.gatewayRef,
        processedAt: p.processedAt,
        invoiceId: p.invoiceId,
        clientId: p.invoice.clientId,
        bookingId: p.invoice.bookingId,
        zohoMirror: byInvoice.get(p.invoiceId) ?? null,
      })),
      meta: {
        page: q.page,
        perPage: q.perPage,
        total,
        totalPages: Math.ceil(total / q.perPage) || 1,
      },
    };
  }
}
