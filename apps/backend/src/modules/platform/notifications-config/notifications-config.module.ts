import { Module } from '@nestjs/common';
import { PlatformSettingsModule } from '../settings/platform-settings.module';
import { GetNotificationDefaultsHandler } from './get-notification-defaults.handler';
import { UpdateNotificationDefaultsHandler } from './update-notification-defaults.handler';


@Module({
  imports: [PlatformSettingsModule],
  providers: [GetNotificationDefaultsHandler, UpdateNotificationDefaultsHandler],
  exports: [GetNotificationDefaultsHandler, UpdateNotificationDefaultsHandler],
})
export class NotificationsConfigModule {}
