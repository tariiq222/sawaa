import { Module } from '@nestjs/common';
import { AuthenticaModule } from '../../../infrastructure/authentica';
import { EmailModule } from '../../../infrastructure/email/email.module';
import { EmailChannelAdapter } from './email-channel.adapter';
import { SmsChannelAdapter } from './sms-channel.adapter';
import { NotificationChannelRegistry } from './notification-channel-registry';

@Module({
  imports: [AuthenticaModule, EmailModule],
  providers: [EmailChannelAdapter, SmsChannelAdapter, NotificationChannelRegistry],
  exports: [NotificationChannelRegistry],
})
export class NotificationChannelModule {}
