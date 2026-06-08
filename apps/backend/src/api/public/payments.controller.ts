import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiCreatedResponse } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { InitClientPaymentHandler } from '../../modules/finance/payments/client/init-client-payment/init-client-payment.handler';
import { InitClientPaymentDto } from '../../modules/finance/payments/client/init-client-payment/init-client-payment.dto';

@ApiTags('Public / Payments')
@ApiPublicResponses()
@Controller('public/payments')
export class PublicPaymentsController {
  constructor(private readonly initClientPayment: InitClientPaymentHandler) {}

  @Public()
  @ApiBearerAuth()
  @UseGuards(ClientSessionGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('init')
  @ApiOperation({ summary: 'Initialize a Moyasar payment for a booking invoice (requires a logged-in client session)' })
  @ApiCreatedResponse({
    description: 'Payment initialized',
    schema: {
      type: 'object',
      required: ['paymentId', 'redirectUrl'],
      properties: {
        paymentId: { type: 'string', format: 'uuid' },
        redirectUrl: { type: 'string', example: 'https://checkout.moyasar.com/pay/payment-id' },
      },
    },
  })
  async initPayment(
    @Body() dto: InitClientPaymentDto,
    @ClientSession() client: { id: string },
  ) {
    // SECURITY: the invoice is bound to the authenticated client by the handler
    // (ForbiddenException if the invoice does not belong to this client).
    return this.initClientPayment.execute({
      clientId: client.id,
      invoiceId: dto.invoiceId,
      method: dto.method,
    });
  }
}
