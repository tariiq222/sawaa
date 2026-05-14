import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { ApiStandardResponses } from '../../common/swagger';
import { ListSiteSettingsHandler } from '../../modules/content/site-settings/list-site-settings.handler';
import { BulkUpsertSiteSettingsHandler } from '../../modules/content/site-settings/bulk-upsert-site-settings.handler';
import { BulkUpsertSiteSettingsDto } from '../../modules/content/site-settings/bulk-upsert-site-settings.dto';

@ApiTags('Dashboard / Content')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/content')
export class DashboardContentController {
  constructor(
    private readonly listSettings: ListSiteSettingsHandler,
    private readonly bulkUpsert: BulkUpsertSiteSettingsHandler,
  ) {}

  @Get('site-settings')
  @CheckPermissions({ action: 'read', subject: 'Content' })
  @ApiOperation({ summary: 'List site settings (admin view)' })
  @ApiQuery({ name: 'prefix', required: false, description: 'Filter by key prefix' })
  @ApiOkResponse({
    description: 'Array of key/value settings',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string', example: 'site.title' },
          value: { type: 'string' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  list(@Query('prefix') prefix?: string) {
    return this.listSettings.execute({ prefix });
  }

  @Post('site-settings')
  @CheckPermissions({ action: 'manage', subject: 'Content' })
  @ApiOperation({ summary: 'Upsert one or more site settings in a single transaction' })
  @ApiOkResponse({
    description: 'Count of rows updated',
    schema: {
      type: 'object',
      properties: { count: { type: 'number', example: 3 } },
    },
  })
  upsert(@Body() dto: BulkUpsertSiteSettingsDto) {
    return this.bulkUpsert.execute(dto);
  }
}
