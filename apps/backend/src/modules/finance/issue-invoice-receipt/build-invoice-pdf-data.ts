import type { Invoice } from '@prisma/client';
import type { ClsService } from 'nestjs-cls';
import { PLATFORM_BRAND } from '@sawaa/shared';
import type { PrismaService } from '../../../infrastructure/database';
import { SYSTEM_CONTEXT_CLS_KEY } from '../../../common/constants';
import type { InvoicePdfData } from './invoice-pdf.template';

/**
 * Assemble the data needed to render an invoice PDF. Shared by the
 * payment-completed receipt handler (which knows the exact payment) and the
 * on-demand dashboard generator (which falls back to the latest completed
 * payment). All lookups run inside a system CLS context.
 *
 * @param paymentId when provided, resolves the payment method from that exact
 *   payment; otherwise uses the invoice's latest COMPLETED payment (or '—').
 */
export async function buildInvoicePdfData(
  prisma: PrismaService,
  cls: ClsService,
  invoice: Invoice,
  paymentId?: string | null,
): Promise<InvoicePdfData> {
  const [orgSettings, client, payment, booking] = await cls.run(async () => {
    cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
    return Promise.all([
      prisma.organizationSettings.findFirst({
        select: { companyNameAr: true, vatRegistrationNumber: true, sellerAddress: true },
      }),
      prisma.client.findUnique({
        where: { id: invoice.clientId },
        select: { firstName: true, lastName: true },
      }),
      paymentId
        ? prisma.payment.findFirst({
            where: { id: paymentId },
            select: { method: true },
          })
        : prisma.payment.findFirst({
            where: { invoiceId: invoice.id, status: 'COMPLETED' },
            orderBy: { createdAt: 'desc' },
            select: { method: true },
          }),
      invoice.bookingId
        ? prisma.booking.findFirst({
            where: { id: invoice.bookingId },
            select: { serviceNameSnapshot: true },
          })
        : null,
    ]);
  });

  return {
    invoiceNumber: invoice.number,
    invoiceId: invoice.id,
    issuedAt: invoice.issuedAt ?? invoice.createdAt,
    paidAt: invoice.paidAt ?? new Date(),
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
    total: Number(invoice.total),
    currency: invoice.currency,
    paymentMethod: payment?.method ?? '—',
    qrDataUrl: null,
  };
}
