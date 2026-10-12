import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClientRoute } from '../../common/auth/client-route.decorator';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { ApiStandardResponses } from '../../common/swagger';
import { ClientThrottle } from '../../common/throttle/client-throttle';
import { ClientRequestRefundDto } from '../../modules/finance/client-request-refund.dto';
import { RequestRefundHandler } from '../../modules/finance/refund-payment/request-refund.handler';

@ApiTags('Client / Refunds')
@ApiStandardResponses()
@ClientRoute()
@Controller('client/refunds')
export class ClientRefundsController {
  constructor(private readonly requestRefundHandler: RequestRefundHandler) {}

  @ClientThrottle('money')
  @Post('request')
  @ApiOperation({ summary: 'Request a refund for an invoice' })
  request(@ClientSession() session: ClientSession, @Body() dto: ClientRequestRefundDto) {
    return this.requestRefundHandler.execute({ ...dto, clientId: session.id });
  }
}
