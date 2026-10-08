import { Injectable, Logger } from '@nestjs/common';
import { OtpChannel } from '@prisma/client';
import { AuthenticaClient } from '../../../infrastructure/authentica';
import { NotificationChannel } from './notification-channel';

@Injectable()
export class SmsChannelAdapter implements NotificationChannel {
  private readonly logger = new Logger(SmsChannelAdapter.name);
  readonly kind = OtpChannel.SMS;

  constructor(private readonly authentica: AuthenticaClient) {}

  async send(identifier: string, code: string, _organizationId?: string): Promise<void> {
    if (!this.authentica.isConfigured()) {
      this.logger.warn('SmsChannelAdapter: Authentica not configured; OTP not sent');
      return;
    }

    try {
      await this.authentica.sendOtp({ channel: 'SMS', identifier, code });
    } catch (err) {
      this.logger.error('SmsChannelAdapter: OTP provider failure');
      throw err;
    }
  }
}
