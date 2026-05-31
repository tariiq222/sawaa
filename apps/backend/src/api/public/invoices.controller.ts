import { Controller, Get, Param, UseGuards, ParseUUIDPipe, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { ApiPublicResponses } from '../../common/swagger';
import { GetPublicInvoiceHandler } from '../../modules/finance/get-invoice/get-public-invoice.handler';
import { MinioService } from '../../infrastructure/storage/minio.service';
import {
  FINANCE_INVOICES_BUCKET_NAME,
  extractInvoicePdfKey,
} from '../../modules/finance/issue-invoice-receipt/invoice-pdf-key.helper';

// Short-lived presigned download window for client-facing PDF links (5 minutes).
const INVOICE_PDF_URL_EXPIRY_SECONDS = 300;

@ApiTags('Public / Invoices')
@ApiBearerAuth()
@ApiPublicResponses()
@Controller('public/invoices')
export class PublicInvoicesController {
  constructor(
    private readonly getPublicInvoice: GetPublicInvoiceHandler,
    private readonly storage: MinioService,
  ) {}

  @UseGuards(ClientSessionGuard)
  @Get(':id')
  @ApiOperation({ summary: 'Get invoice details (requires client auth)' })
  async getInvoice(
    @Param('id', ParseUUIDPipe) id: string,
    @ClientSession() client: { id: string },
  ) {
    return this.getPublicInvoice.execute(id, client.id);
  }

  @UseGuards(ClientSessionGuard)
  @Get(':id/pdf')
  @ApiOperation({ summary: 'Get a URL to download the invoice PDF (client-owned only)' })
  async getPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @ClientSession() client: { id: string },
  ) {
    const invoice = await this.getPublicInvoice.execute(id, client.id);
    if (!invoice.pdfUrl) {
      throw new NotFoundException('No PDF has been generated for this invoice yet');
    }
    // `pdfUrl` stores the MinIO object key (S2.3a). Mint a short-lived presigned
    // URL instead of returning the raw stored value. Legacy rows that hold a
    // full URL are normalised back to the key first.
    const key = extractInvoicePdfKey(invoice.pdfUrl);
    const url = await this.storage.getSignedUrl(
      FINANCE_INVOICES_BUCKET_NAME,
      key,
      INVOICE_PDF_URL_EXPIRY_SECONDS,
    );
    return { url };
  }
}