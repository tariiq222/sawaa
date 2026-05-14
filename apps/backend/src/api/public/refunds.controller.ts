import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { ApiPublicResponses } from '../../common/swagger';
import { RequestRefundHandler } from '../../modules/finance/refund-payment/request-refund.handler';

class RequestRefundDto {
  invoiceId!: string;
  reason?: string;
}

@ApiTags('Public / Refunds')
@ApiBearerAuth()
@ApiPublicResponses()
@Controller('public/refunds')
export class PublicRefundsController {
  constructor(private readonly requestRefundHandler: RequestRefundHandler) {}

  @UseGuards(ClientSessionGuard)
  @Post('request')
  @ApiOperation({ summary: 'Request a refund for an invoice (requires client auth)' })
  async requestRefund(
    @ClientSession() client: { id: string },
    @Body() dto: RequestRefundDto,
  ) {
    return this.requestRefundHandler.execute({
      ...dto,
      clientId: client.id,
    });
  }
}