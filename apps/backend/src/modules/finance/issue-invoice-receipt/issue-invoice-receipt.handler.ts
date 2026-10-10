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

export interface IssueReceiptOptions {
  /** When false the receipt is stored but no delivery event is queued. */
  deliver?: boolean;
  /** Carried on the delivery event; defaults to DEFAULT_ORG_ID. */
  organizationId?: string;
}

/**
 * Subscribes to `finance.payment.completed`. When the related invoice has
 * reached PAID status and no receipt has been issued yet, renders the receipt
 * PDF (listing every COMPLETED payment), uploads it to MinIO under
 * `receipts/<invoiceId>/<paymentId>.pdf`, and atomically records the key
 * (`receiptPdfKey`, `receiptIssuedAt`, `receiptPaymentId`) together with an
 * outbox event for `finance.invoice.receipt.issued`.
 *
 * Idempotency: one receipt per invoice, guarded by `receiptIssuedAt: null` in
 * the update. A legacy `pdfUrl` never blocks issuance. The outbox event is
 * staged only by the caller that wins the guarded update. Safe for
 * at-least-once delivery.
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
    await this.issue(invoiceId, paymentId, { organizationId });
  }

  async issue(
    invoiceId: string,
    paymentId: string,
    options: IssueReceiptOptions = {},
  ): Promise<void> {
    const deliver = options.deliver !== false;

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
    if (invoice.receiptIssuedAt) {
      this.logger.log(`Receipt: invoice ${invoiceId} already has a receipt — skipping`);
      return;
    }

    // Owner rule: an invoice containing a "previous receipt" payment gets no receipt.
    const previousReceipt = await this.cls.run(async () => {
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      return this.prisma.payment.findFirst({
        where: { invoiceId: invoice.id, receiptRecordedBy: { not: null } },
        select: { id: true },
      });
    });
    if (previousReceipt) {
      this.logger.log(`Receipt: invoice ${invoiceId} has a previous-receipt payment — skipping`);
      return;
    }

    // Invoice keeps a scalar cross-domain bookingId, not a Prisma relation.
    const booking = invoice.bookingId ? await this.cls.run(async () => {
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      return this.prisma.booking.findFirst({
        where: { id: invoice.bookingId! },
        select: { lateEntryRecordedAt: true },
      });
    }) : null;
    const data = await buildInvoicePdfData(this.prisma, this.cls, invoice, 'receipt');
    const pdfBuffer = await this.renderer.render(data);

    const key = `receipts/${invoice.id}/${paymentId}.pdf`;
    // Perform the upload for its side effect, but DISCARD the raw public URL it
    // returns. We persist the storage KEY (bucket = 'finance-invoices') instead,
    // so read endpoints/email can mint short-lived presigned URLs and no raw,
    // un-presigned object URL ever leaks (S2.3a).
    await this.storage.uploadFile(BUCKET, key, pdfBuffer, 'application/pdf');

    const issued = new InvoiceReceiptIssuedEvent({
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      clientId: invoice.clientId,
      // Carries the receipt storage KEY (not a URL); field name kept for
      // in-flight event compatibility. The email handler presigns it.
      pdfUrl: key,
      organizationId: options.organizationId ?? DEFAULT_ORG_ID,
    });
    const won = await this.cls.run(async () => {
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      return this.rlsTransaction.withTransaction(async (tx) => {
        // Commit the receipt and its delivery intent together. The guarded
        // write also prevents concurrent payment events from issuing two.
        const { count } = await tx.invoice.updateMany({
          where: { id: invoice.id, status: 'PAID', receiptIssuedAt: null },
          data: {
            receiptPdfKey: key,
            receiptIssuedAt: new Date(),
            receiptPaymentId: paymentId,
          },
        });
        if (count === 0) return false;
        if (deliver && !booking?.lateEntryRecordedAt) {
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
        }
        return true;
      });
    });
    if (!won) {
      this.logger.log(`Receipt: invoice ${invoiceId} was receipted concurrently — discarding ${key}`);
      await this.discardLostUpload(invoice.id, key);
    }
  }

  /** Best-effort cleanup of an upload whose guarded update lost the race. */
  private async discardLostUpload(invoiceId: string, key: string): Promise<void> {
    try {
      const current = await this.cls.run(async () => {
        this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
        return this.prisma.invoice.findUnique({
          where: { id: invoiceId },
          select: { receiptPdfKey: true },
        });
      });
      // Same payment => same key: never delete the object the winner stored.
      if (current?.receiptPdfKey === key) return;
      await this.storage.deleteFile(BUCKET, key);
    } catch (err) {
      this.logger.warn(`Receipt: could not delete orphan ${key}: ${(err as Error).message}`);
    }
  }
}
