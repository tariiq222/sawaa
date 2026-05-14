import { Global, Module } from '@nestjs/common';
import { FcmService } from './fcm.service';
import { SmtpService } from './smtp.service';
import { PlatformMailerService } from './platform-mailer.service';
import { PlatformSettingsModule } from '../../modules/platform/settings/platform-settings.module';
import { PlatformMailQueueService } from './platform-mail-queue/platform-mail-queue.service';
import { PlatformMailProcessor } from './platform-mail-queue/platform-mail.processor';
import { ResendSenderService } from './platform-mail-queue/resend-sender.service';

@Global()
@Module({
  imports: [PlatformSettingsModule],
  providers: [
    FcmService,
    SmtpService,
    ResendSenderService,
    PlatformMailQueueService,
    PlatformMailProcessor,
    PlatformMailerService,
  ],
  exports: [
    FcmService,
    SmtpService,
    ResendSenderService,
    PlatformMailQueueService,
    PlatformMailerService,
  ],
})
export class MailModule {}
