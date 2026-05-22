import { Global, Module } from '@nestjs/common';
import { FcmService } from './fcm.service';
import { PlatformSettingsModule } from '../../modules/platform/settings/platform-settings.module';

@Global()
@Module({
  imports: [PlatformSettingsModule],
  providers: [FcmService],
  exports: [FcmService],
})
export class MailModule {}
