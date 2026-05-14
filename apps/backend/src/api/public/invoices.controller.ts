import { Controller, Get, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
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
}