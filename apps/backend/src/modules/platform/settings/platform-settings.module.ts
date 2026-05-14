import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../infrastructure/database';
import { GetPlatformSettingHandler } from './get-platform-setting/get-platform-setting.handler';
import { UpsertPlatformSettingHandler } from './upsert-platform-setting/upsert-platform-setting.handler';
import { PlatformSettingsService } from './platform-settings.service';

@Module({
  imports: [DatabaseModule],
  providers: [GetPlatformSettingHandler, UpsertPlatformSettingHandler, PlatformSettingsService],
  exports: [GetPlatformSettingHandler, UpsertPlatformSettingHandler, PlatformSettingsService],
})
export class PlatformSettingsModule {}
