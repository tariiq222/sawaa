import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database';
import { DashboardContentController } from '../../api/dashboard/content.controller';
import { ListSiteSettingsHandler } from './site-settings/list-site-settings.handler';
import { BulkUpsertSiteSettingsHandler } from './site-settings/bulk-upsert-site-settings.handler';

const handlers = [ListSiteSettingsHandler, BulkUpsertSiteSettingsHandler];

@Module({
  imports: [DatabaseModule],
  controllers: [DashboardContentController],
  providers: handlers,
  exports: handlers,
})
export class ContentModule {}
