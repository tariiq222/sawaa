import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { SYSTEM_CONTEXT_CLS_KEY, DEFAULT_ORG_ID } from '../../../common/constants';
import type { PaymentCompletedPayload } from '../events/payment-completed.event';
import type { Invoice } from '@prisma/client';
import { InvoicePdfRendererService } from './invoice-pdf-renderer.service';
import { InvoiceReceiptIssuedEvent } from './invoice-receipt-issued.event';
import type { InvoicePdfData } from './invoice-pdf.template';

const BUCKET = 'finance-invoices';

/**
 * Subscribes to `finance.payment.completed`. When the related invoice has
 * reached PAID status and no PDF has been generated yet, renders the receipt
 * PDF, uploads it to MinIO, persists the URL on the invoice, and publishes
 * `finance.invoice.receipt.issued` so downstream channels (email/SMS/push)
 * can deliver it to the client.
 *
 * Idempotency: the handler short-circuits when the invoice is missing, not
 * yet PAID, or already has a `pdfUrl`. Safe for at-least-once delivery.
 */
@Injectable()
export class IssueInvoiceReceiptHandler {
  private readonly logger = new Logger(IssueInvoiceReceiptHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly renderer: InvoicePdfRendererService,
    private readonly storage: MinioService,
    private readonly eventBus: EventBusService,
    private readonly cls: ClsService,
  ) {}

  register(): void {
    this.eventBus.subscribe<PaymentCompletedPayload>(
      'finance.payment.completed',
      (envelope) => this.handle(envelope),
    );
  }

  async handle(envelope: DomainEventEnvelope<PaymentCompletedPayload>): Promise<void> {
    const { invoiceId, paymentId, organizationId } = envelope.payload;

    const invoice = await this.cls.run(async () => {
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      return this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    });
    if (!invoice) {
      this.logger.warn(`Receipt: invoice ${invoiceId} not found`);
      return;
    }
    if (invoice.status !== 'PAID') {
      this.logger.log(
        `Receipt: invoice ${invoiceId} not PAID (status=${invoice.status}) — skipping`,
      );
      return;
    }
    if (invoice.pdfUrl) {
      this.logger.log(`Receipt: invoice ${invoiceId} already has PDF — skipping`);
      return;
    }

    const data = await this.buildPdfData(invoice, paymentId);
    const pdfBuffer = await this.renderer.render(data);

    const key = `invoices/${invoice.id}/${Date.now()}.pdf`;
    // Perform the upload for its side effect, but DISCARD the raw public URL it
    // returns. We persist the storage KEY (bucket = 'finance-invoices') on
    // `invoice.pdfUrl` instead, so read endpoints/email can mint short-lived
    // presigned URLs and no raw, un-presigned object URL ever leaks (S2.3a).
    await this.storage.uploadFile(BUCKET, key, pdfBuffer, 'application/pdf');

    await this.cls.run(async () => {
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { pdfUrl: key, pdfGeneratedAt: new Date() },
      });
    });

    const issued = new InvoiceReceiptIssuedEvent({
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      clientId: invoice.clientId,
      // Carries the storage KEY (not a URL); the email handler presigns it.
      pdfUrl: key,
      organizationId: organizationId ?? DEFAULT_ORG_ID,
    });
    await this.eventBus.publish(issued.eventName, issued.toEnvelope());
  }

  private async buildPdfData(invoice: Invoice, paymentId: string): Promise<InvoicePdfData> {
    const [orgSettings, client, payment, booking] = await this.cls.run(async () => {
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      return Promise.all([
        this.prisma.organizationSettings.findFirst({
          select: { companyNameAr: true, vatRegistrationNumber: true, sellerAddress: true },
        }),
        this.prisma.client.findUnique({
          where: { id: invoice.clientId },
          select: { firstName: true, lastName: true },
        }),
        this.prisma.payment.findFirst({
          where: { id: paymentId },
          select: { method: true },
        }),
        invoice.bookingId
          ? this.prisma.booking.findFirst({
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
      clientName: client ? `${client.firstName} ${client.lastName ?? ''}`.trim() : '—',
      serviceName: booking?.serviceNameSnapshot ?? (invoice.bundlePurchaseId ? 'باقة جلسات' : '—'),
      subtotal: Number(invoice.subtotal),
      discountAmt: Number(invoice.discountAmt),
      vatAmt: Number(invoice.vatAmt),
      total: Number(invoice.total),
      currency: invoice.currency,
      paymentMethod: payment?.method ?? '—',
      qrDataUrl: null,
    };
  }
}
