import type { Invoice } from '@prisma/client';
import type { ClsService } from 'nestjs-cls';
import { PLATFORM_BRAND } from '@sawaa/shared';
import type { PrismaService } from '../../../infrastructure/database';
import { SYSTEM_CONTEXT_CLS_KEY } from '../../../common/constants';
import { calculateInvoiceBalance } from '../invoice-balance.helper';
import type { InvoicePdfData, InvoicePdfKind } from './invoice-pdf.template';

/**
 * Assemble the data needed to render an invoice PDF. Shared by the
 * payment-completed receipt handler and the on-demand dashboard generator.
 * All lookups run inside a system CLS context.
 *
 * `payments` lists every COMPLETED payment (oldest first) with its effective
 * date, method and amount in halalas. `paidAt` is the invoice's real paidAt
 * and stays null until the invoice is PAID — never a render-time clock.
 * `outstanding` is total minus completed payments (never below zero).
 */
export async function buildInvoicePdfData(
  prisma: PrismaService,
  cls: ClsService,
  invoice: Invoice,
  kind: InvoicePdfKind,
): Promise<InvoicePdfData> {
  const [orgSettings, client, paymentRows, booking] = await cls.run(async () => {
    cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
    return Promise.all([
      prisma.organizationSettings.findFirst({
        select: { companyNameAr: true, vatRegistrationNumber: true, sellerAddress: true },
      }),
      prisma.client.findUnique({
        where: { id: invoice.clientId },
        select: { firstName: true, lastName: true },
      }),
      prisma.payment.findMany({
        where: { invoiceId: invoice.id, status: 'COMPLETED' },
        select: {
          method: true,
          amount: true,
          effectiveReceivedAt: true,
          processedAt: true,
          createdAt: true,
        },
      }),
      invoice.bookingId
        ? prisma.booking.findFirst({
            where: { id: invoice.bookingId },
            select: { serviceNameSnapshot: true },
          })
        : null,
    ]);
  });

  const payments = paymentRows
    .map((p) => ({
      date: p.effectiveReceivedAt ?? p.processedAt ?? p.createdAt,
      method: p.method as string,
      amount: Number(p.amount),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const total = Number(invoice.total);
  const { outstanding } = calculateInvoiceBalance({
    invoiceTotal: total,
    grossSettled: payments.reduce((sum, p) => sum + p.amount, 0),
    refundedSettled: 0,
    reservedPending: 0,
    newCollectionBlocked: false,
  });

  return {
    kind,
    status: invoice.status,
    outstanding,
    invoiceNumber: invoice.number,
    invoiceId: invoice.id,
    issuedAt: invoice.issuedAt ?? invoice.createdAt,
    paidAt: invoice.paidAt ?? null,
    sellerNameAr: orgSettings?.companyNameAr ?? 'مركز سواء',
    sellerVatNumber: orgSettings?.vatRegistrationNumber ?? null,
    sellerAddress: orgSettings?.sellerAddress ?? null,
    logoUrl: null,
    brandColor: PLATFORM_BRAND.colors.primary,
    clientName: client ? `${client.firstName} ${client.lastName ?? ''}`.trim() : '—',
    serviceName: booking?.serviceNameSnapshot ?? (invoice.packagePurchaseId ? 'باقة جلسات' : '—'),
    subtotal: Number(invoice.subtotal),
    discountAmt: Number(invoice.discountAmt),
    vatAmt: Number(invoice.vatAmt),
    total,
    currency: invoice.currency,
    paymentMethod: payments.length > 0 ? payments[payments.length - 1].method : '—',
    payments,
    qrDataUrl: null,
  };
}
