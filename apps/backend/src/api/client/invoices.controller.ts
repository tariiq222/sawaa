import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClientRoute } from '../../common/auth/client-route.decorator';
import { toClientInvoice } from './client-invoice.projection';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { ApiErrorDto, ApiStandardResponses } from '../../common/swagger';
import { MinioService } from '../../infrastructure/storage/minio.service';
import { ClientListQueryDto } from '../../modules/finance/client-list-query.dto';
import { GetPublicInvoiceHandler } from '../../modules/finance/get-invoice/get-public-invoice.handler';
import {
  FINANCE_INVOICES_BUCKET_NAME,
  extractInvoicePdfKey,
} from '../../modules/finance/issue-invoice-receipt/invoice-pdf-key.helper';
import { ListClientInvoicesHandler } from '../../modules/finance/list-client-invoices/list-client-invoices.handler';

// Short-lived presigned download window for client-facing PDF links (5 minutes).
const INVOICE_PDF_URL_EXPIRY_SECONDS = 300;

@ApiTags('Client / Invoices')
@ApiStandardResponses()
@ClientRoute()
@Controller('client/invoices')
export class ClientInvoicesController {
  constructor(
    private readonly listClientInvoices: ListClientInvoicesHandler,
    private readonly getPublicInvoice: GetPublicInvoiceHandler,
    private readonly storage: MinioService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List client invoices' })
  @ApiOkResponse({ schema: {
    type: 'object', description: 'Paginated invoices with the full client outstanding balance',
    required: ['items', 'total', 'page', 'pageSize', 'outstandingBalance'],
    properties: {
      items: { type: 'array', items: { type: 'object' } },
      total: { type: 'integer', minimum: 0 },
      page: { type: 'integer', minimum: 1 },
      pageSize: { type: 'integer', minimum: 1 },
      outstandingBalance: { type: 'integer', minimum: 0, description: 'Outstanding balance across all client invoices, in halalas' },
    },
  } })
  list(@ClientSession() session: ClientSession, @Query() q: ClientListQueryDto) {
    return this.listClientInvoices.execute(session.id, q.page ?? 1, q.pageSize ?? 20);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an invoice by id (client-scoped)' })
  @ApiParam({ name: 'id', description: 'Invoice UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Invoice found. `hasReceipt` tells whether a paid receipt PDF exists (fetch it via GET :id/pdf); the storage key is never returned.' })
  @ApiResponse({ status: 404, description: 'Invoice not found', type: ApiErrorDto })
  async get(@Param('id', ParseUUIDPipe) id: string, @ClientSession() session: ClientSession) {
    // Ownership is part of the query: a foreign id is a 404, never a 403.
    return toClientInvoice(await this.getPublicInvoice.execute(id, session.id));
  }

  @Get(':id/pdf')
  @ApiOperation({
    summary: 'Get a URL to download the paid receipt PDF (client-owned only)',
    description: 'Returns a short-lived URL for the paid receipt only. Responds 404 when no receipt has been issued for the invoice.',
  })
  @ApiParam({ name: 'id', description: 'Invoice UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Short-lived URL of the paid receipt PDF' })
  @ApiResponse({ status: 404, description: 'No receipt has been issued for this invoice', type: ApiErrorDto })
  async getPdf(@Param('id', ParseUUIDPipe) id: string, @ClientSession() session: ClientSession) {
    const invoice = await this.getPublicInvoice.execute(id, session.id);
    if (!invoice.pdfUrl) {
      throw new NotFoundException('No paid receipt has been issued for this invoice');
    }
    // `pdfUrl` here is the frozen receipt object key (Invoice.receiptPdfKey).
    // Only a short-lived presigned URL is returned, never the bare key.
    const key = extractInvoicePdfKey(invoice.pdfUrl);
    const url = await this.storage.getSignedUrl(FINANCE_INVOICES_BUCKET_NAME, key, INVOICE_PDF_URL_EXPIRY_SECONDS);
    return { url };
  }
}
