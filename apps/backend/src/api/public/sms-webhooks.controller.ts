// Provider DLR webhook endpoints.
// Authentication: HMAC signature header on the inbound payload.

import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/guards/jwt.guard';
import { SmsDlrHandler } from '../../modules/comms/sms-dlr/sms-dlr.handler';
import { DEFAULT_ORG_ID } from '../../common/constants';
import { ApiErrorDto } from '../../common/swagger';
import { SmsWebhookDeliveryReceiptAckDto } from './sms-webhook-response.dto';

const SUPPORTED_PROVIDERS = new Set(['UNIFONIC', 'TAQNYAT']);

@ApiTags('Public / SMS Webhooks')
@Controller('public/sms/webhooks')
export class PublicSmsWebhooksController {
  constructor(private readonly dlr: SmsDlrHandler) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @Post(':provider')
  @HttpCode(200)
  @ApiOperation({ summary: 'Inbound SMS delivery-receipt webhook' })
  @ApiParam({ name: 'provider', enum: ['UNIFONIC', 'TAQNYAT'] })
  @ApiOkResponse({
    type: SmsWebhookDeliveryReceiptAckDto,
    description:
      'Receipt acknowledged. An empty object `{}` means a delivery row was advanced; ' +
      '`{ skipped: true }` means the receipt was a duplicate, stale/out-of-order, or did not match the configured provider.',
  })
  @ApiResponse({ status: 400, description: 'Unsupported provider, missing request body, missing X-Signature header, no stored webhook secret, or configured-provider mismatch', type: ApiErrorDto })
  @ApiResponse({ status: 500, description: 'Signature verification, payload parsing or infrastructure failure; the provider should retry', type: ApiErrorDto })
  async handle(
    @Param('provider') provider: string,
    @Headers('x-signature') signatureHeader: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<SmsWebhookDeliveryReceiptAckDto> {
    const providerUpper = provider.toUpperCase();
    if (!SUPPORTED_PROVIDERS.has(providerUpper)) {
      throw new BadRequestException(`Unsupported SMS provider: ${provider}`);
    }
    const raw = req.rawBody?.toString('utf8');
    if (!raw) {
      throw new BadRequestException('Missing request body');
    }
    if (!signatureHeader) {
      throw new BadRequestException('Missing X-Signature header');
    }
    return this.dlr.execute({
      provider: providerUpper as 'UNIFONIC' | 'TAQNYAT',
      organizationId: DEFAULT_ORG_ID,
      rawBody: raw,
      signature: signatureHeader,
    });
  }
}