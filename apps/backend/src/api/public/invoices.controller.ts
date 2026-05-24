import { Controller, Get, Param, UseGuards, ParseUUIDPipe, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { ApiPublicResponses } from '../../common/swagger';
import { GetPublicInvoiceHandler } from '../../modules/finance/get-invoice/get-public-invoice.handler';

@ApiTags('Public / Invoices')
@ApiBearerAuth()
@ApiPublicResponses()
@Controller('public/invoices')
export class PublicInvoicesController {
  constructor(private readonly getPublicInvoice: GetPublicInvoiceHandler) {}

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
    return { url: invoice.pdfUrl };
  }
}