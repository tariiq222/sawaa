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
 * On-demand invoice document for the dashboard "generate PDF" action.
 *
 * When the invoice already has an issued receipt (`receiptPdfKey`) that frozen
 * key is returned unchanged and nothing is re-rendered. Otherwise a live
 * STATEMENT is rendered and uploaded to the fixed key `statements/<invoiceId>.pdf`
 * (overwritten each time, so it always reflects current payments). This handler
 * never writes the Invoice row: a statement is not a receipt and must not
 * suppress receipt issuance. The caller (controller) mints the short-lived
 * presigned URL from the returned key.
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
    if (invoice.receiptPdfKey) {
      return invoice.receiptPdfKey;
    }

    const data = await buildInvoicePdfData(this.prisma, this.cls, invoice, 'statement');
    const pdfBuffer = await this.renderer.render(data);

    const key = `statements/${invoice.id}.pdf`;
    await this.storage.uploadFile(BUCKET, key, pdfBuffer, 'application/pdf');
    return key;
  }
}
