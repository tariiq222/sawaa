import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/guards/jwt.guard';
import { MoyasarWebhookHandler } from '../../modules/finance/moyasar-webhook/moyasar-webhook.handler';
import { MoyasarWebhookDto } from '../../modules/finance/moyasar-webhook/moyasar-webhook.dto';

@ApiTags('Public / Payments')
@Controller('public/payments/webhook')
export class PublicPaymentWebhookController {
  private readonly logger = new Logger(PublicPaymentWebhookController.name);

  constructor(private readonly handler: MoyasarWebhookHandler) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Receive Moyasar booking-payment webhook events' })
  @ApiOkResponse({ schema: { type: 'object', properties: { received: { type: 'boolean' } } } })
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-moyasar-signature') signature: string | undefined,
    @Body() payload: MoyasarWebhookDto,
  ) {
    const rawBody = req.rawBody?.toString('utf8');
    // A missing body is malformed input — it will never succeed on retry.
    // Drop-and-ack with HTTP 200 (and a log) so Moyasar stops retrying,
    // rather than 400 which triggers an infinite retry storm.
    if (!rawBody) {
      this.logger.warn('Moyasar webhook rejected: missing request body');
      return { skipped: true, reason: 'missing_body' };
    }
    // A missing `X-Moyasar-Signature` header is NOT fatal: the merchant may
    // be configured to carry the shared secret in the body `secret_token`
    // field instead. Pass the signature through as an empty string and let
    // the handler decide which verification channel applies (and 200-ack
    // skip if neither is present). The controller never returns 4xx for a
    // malformed webhook — only genuine 5xx infrastructure errors propagate.
    return this.handler.execute({ payload, rawBody, signature: signature ?? '' });
  }
}
