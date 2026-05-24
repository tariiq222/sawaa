import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../../infrastructure/database';
import { EmailProviderFactory } from '../../../infrastructure/email/email-provider.factory';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { SYSTEM_CONTEXT_CLS_KEY } from '../../../common/constants';
import type { InvoiceReceiptIssuedPayload } from './invoice-receipt-issued.event';

/**
 * Subscribes to `finance.invoice.receipt.issued`. Looks up the client's email
 * and, when present, sends a bilingual-friendly RTL HTML message with the PDF
 * download link. Marks the invoice `sentToClientAt` on success so other
 * channels (SMS/push) can short-circuit if needed.
 *
 * Failures propagate so BullMQ retries the job.
 */
@Injectable()
export class SendInvoiceReceiptHandler {
  private readonly logger = new Logger(SendInvoiceReceiptHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailFactory: EmailProviderFactory,
    private readonly cls: ClsService,
  ) {}

  register(eventBus: EventBusService): void {
    eventBus.subscribe<InvoiceReceiptIssuedPayload>(
      'finance.invoice.receipt.issued',
      (envelope) => this.handle(envelope),
    );
  }

  async handle(envelope: DomainEventEnvelope<InvoiceReceiptIssuedPayload>): Promise<void> {
    const { invoiceId, invoiceNumber, clientId, pdfUrl } = envelope.payload;

    const client = await this.cls.run(async () => {
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      return this.prisma.client.findUnique({
        where: { id: clientId },
        select: { email: true, firstName: true },
      });
    });

    if (!client?.email) {
      this.logger.log(`Receipt email: client ${clientId} has no email — skipping`);
      return;
    }

    const provider = await this.emailFactory.resolve();
    const subject = `فاتورتك من مركز سواء — رقم ${invoiceNumber}`;
    const html = `
      <div dir="rtl" style="font-family: sans-serif; padding: 24px;">
        <h2>شكراً لك ${client.firstName ?? ''}</h2>
        <p>هذه فاتورتك رقم <strong>#${invoiceNumber}</strong> بعد اكتمال الدفع.</p>
        <p><a href="${pdfUrl}" style="background:#0a7;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">تنزيل الفاتورة (PDF)</a></p>
        <p style="color:#666;font-size:13px;margin-top:24px;">إذا لم يعمل الزر، انسخ الرابط: ${pdfUrl}</p>
      </div>
    `;

    try {
      await provider.sendMail({ to: client.email, subject, html });
      await this.cls.run(async () => {
        this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
        await this.prisma.invoice.update({
          where: { id: invoiceId },
          data: { sentToClientAt: new Date() },
        });
      });
    } catch (err) {
      this.logger.error(`Receipt email failed for invoice ${invoiceId}`, err);
      throw err; // BullMQ retries
    }
  }
}
