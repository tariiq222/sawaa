import { Injectable } from '@nestjs/common';
import { OtpChannel } from '@prisma/client';
import { NotificationChannel } from './notification-channel';
import { EmailChannelAdapter } from './email-channel.adapter';
import { SmsChannelAdapter } from './sms-channel.adapter';

@Injectable()
export class NotificationChannelRegistry {
  private readonly channels: Map<OtpChannel, NotificationChannel> = new Map();

  constructor(
    private readonly emailAdapter: EmailChannelAdapter,
    private readonly smsAdapter: SmsChannelAdapter,
  ) {
    this.channels.set(OtpChannel.EMAIL, this.emailAdapter);
    this.channels.set(OtpChannel.SMS, this.smsAdapter);
  }

  resolve(kind: OtpChannel): NotificationChannel {
    const channel = this.channels.get(kind);
    if (!channel) {
      throw new Error(`No notification channel registered for kind: ${kind}`);
    }
    return channel;
  }
}
