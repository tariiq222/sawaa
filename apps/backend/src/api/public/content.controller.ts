import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { ListSiteSettingsHandler } from '../../modules/content/site-settings/list-site-settings.handler';

@ApiTags('Public / Content')
@ApiPublicResponses()
@Controller('public/content')
export class PublicContentController {
  constructor(private readonly listSettings: ListSiteSettingsHandler) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Get('site-settings')
  @ApiOperation({ summary: 'List site settings (optionally filtered by key prefix)' })
  @ApiQuery({
    name: 'prefix',
    required: false,
    description: 'Filter by key prefix (e.g. "home.hero.")',
  })
  @ApiOkResponse({ description: 'Array of key/value settings' })
  list(@Query('prefix') prefix?: string) {
    return this.listSettings.execute({ prefix });
  }
}
