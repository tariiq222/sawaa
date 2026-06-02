import { Injectable, NotFoundException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { SYSTEM_CONTEXT_CLS_KEY } from '../../../common/constants';
import { InvoicePdfRendererService } from '../issue-invoice-receipt/invoice-pdf-renderer.service';
import { buildInvoicePdfData } from '../issue-invoice-receipt/build-invoice-pdf-data';

const BUCKET = 'finance-invoices';

export interface GenerateInvoicePdfCommand {
  invoiceId: string;
}

/**
 * On-demand invoice PDF generation for the dashboard "generate PDF" action.
 *
 * Unlike {@link IssueInvoiceReceiptHandler} — which only fires for PAID
 * invoices via the `finance.payment.completed` event — this renders a PDF for
 * an invoice in ANY status (draft, unpaid, partially paid, paid). It does not
 * publish a receipt event; it just materialises the file so the caller can
 * download it.
 *
 * Idempotent: when the invoice already has a `pdfUrl` the stored object key is
 * returned unchanged (a paid receipt's ZATCA stamp must stay frozen). Otherwise
 * it renders, uploads to MinIO, persists the key, and returns it. The caller
 * (controller) mints the short-lived presigned URL from the returned key.
 */
@Injectable()
export class GenerateInvoicePdfHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly renderer: InvoicePdfRendererService,
    private readonly storage: MinioService,
    private readonly cls: ClsService,
  ) {}

  /** @returns the stored MinIO object key for the invoice PDF. */
  async execute({ invoiceId }: GenerateInvoicePdfCommand): Promise<string> {
    const invoice = await this.cls.run(async () => {
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      return this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }
    if (invoice.pdfUrl) {
      return invoice.pdfUrl;
    }

    const data = await buildInvoicePdfData(this.prisma, this.cls, invoice);
    const pdfBuffer = await this.renderer.render(data);

    const key = `invoices/${invoice.id}/${Date.now()}.pdf`;
    await this.storage.uploadFile(BUCKET, key, pdfBuffer, 'application/pdf');

    await this.cls.run(async () => {
      this.cls.set(SYSTEM_CONTEXT_CLS_KEY, true);
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { pdfUrl: key, pdfGeneratedAt: new Date() },
      });
    });

    return key;
  }
}
