// Provider DLR webhook endpoint.
// Authentication: path param :provider + HMAC signature header.

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
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/guards/jwt.guard';
import { SmsDlrHandler } from '../../modules/comms/sms-dlr/sms-dlr.handler';
import { DEFAULT_ORG_ID } from '../../common/constants';

const SUPPORTED_PROVIDERS = new Set(['UNIFONIC', 'TAQNYAT']);

@ApiTags('Public / SMS Webhooks')
@Controller('public/sms/webhooks')
export class PublicSmsWebhooksController {
  constructor(private readonly dlr: SmsDlrHandler) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @Post(':provider/:organizationId')
  @HttpCode(200)
  @ApiOperation({ summary: 'Inbound SMS delivery-receipt webhook' })
  @ApiParam({ name: 'provider', enum: ['UNIFONIC', 'TAQNYAT'] })
  @ApiParam({ name: 'organizationId', description: 'Organization id (legacy path param)' })
  @ApiOkResponse({ schema: { type: 'object', properties: { received: { type: 'boolean' } } } })
  async handle(
    @Param('provider') provider: string,
    @Param('organizationId') organizationId: string,
    @Headers('x-signature') signatureHeader: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const providerUpper = provider.toUpperCase();
    if (!SUPPORTED_PROVIDERS.has(providerUpper)) {
      throw new BadRequestException(`Unsupported SMS provider: ${provider}`);
    }
    if (organizationId !== DEFAULT_ORG_ID) {
      throw new BadRequestException(`Unknown organization: ${organizationId}`);
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
