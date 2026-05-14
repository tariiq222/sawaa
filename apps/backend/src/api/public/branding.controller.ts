import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { GetPublicBrandingHandler } from '../../modules/org-experience/branding/public/get-public-branding.handler';

@ApiTags('Public / Branding')
@ApiPublicResponses()
@Controller('public/branding')
export class PublicBrandingController {
  constructor(private readonly getBranding: GetPublicBrandingHandler) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Get()
  @ApiOperation({ summary: 'Get clinic branding (public)' })
  @ApiOkResponse({ description: 'PublicBranding shape' })
  getBrandingEndpoint() {
    return this.getBranding.execute();
  }
}