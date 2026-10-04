import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { SYSTEM_CONTEXT_CLS_KEY, DEFAULT_ORG_ID } from '../../../common/constants';
import type { PaymentCompletedPayload } from '../events/payment-completed.event';
import { InvoicePdfRendererService } from './invoice-pdf-renderer.service';
import { InvoiceReceiptIssuedEvent } from './invoice-receipt-issued.event';
import { buildInvoicePdfData } from './build-invoice-pdf-data';

const BUCKET = 'finance-invoices';

/**
 * Subscribes to `finance.payment.completed`. When the related invoice has
 * reached PAID status and no PDF has been generated yet, renders the receipt
 * PDF, uploads it to MinIO, atomically persists the storage key and an outbox event for
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
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  register(): void {
    this.eventBus.subscribe<PaymentCompletedPayload>(
      'finance.payment.completed',
      'finance.payment-completed-receipt.v1',
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

    const data = await buildInvoicePdfData(this.prisma, this.cls, invoice, paymentId);
    const pdfBuffer = await this.renderer.render(data);

    const key = `invoices/${invoice.id}/${Date.now()}.pdf`;
    // Perform the upload for its side effect, but DISCARD the raw public URL it
    // returns. We persist the storage KEY (bucket = 'finance-invoices') on
    // `invoice.pdfUrl` instead, so read endpoints/email can mint short-lived
    // presigned URLs and no raw, un-presigned object URL ever leaks (S2.3a).
    await this.storage.uploadFile(BUCKET, key, pdfBuffer, 'application/pdf');

    const issued = new InvoiceReceiptIssuedEvent({
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      clientId: invoice.clientId,
      // Carries the storage KEY (not a URL); the email handler presigns it.
      pdfUrl: key,
      organizationId: organizationId ?? DEFAULT_ORG_ID,
    });
    await this.cls.run(async () => {
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      await this.rlsTransaction.withTransaction(async (tx) => {
        // Commit the PDF and its delivery intent together. The guarded write
        // also prevents concurrent payment events from issuing two receipts.
        const { count } = await tx.invoice.updateMany({
          where: { id: invoice.id, status: 'PAID', pdfUrl: null },
          data: { pdfUrl: key, pdfGeneratedAt: new Date() },
        });
        if (count === 0) return;
        await tx.outboxEvent.create({
          data: {
            id: issued.eventId,
            aggregateId: invoice.id,
            eventType: issued.eventName,
            status: 'PENDING_V2',
            deliveryLane: 'PENDING_V2',
            payload: issued.toEnvelope() as unknown as Prisma.InputJsonValue,
          },
        });
      });
    });
  }
}
