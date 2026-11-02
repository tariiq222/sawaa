import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { OtpChannel } from '@prisma/client';
import { AuthenticaClient } from '../../../infrastructure/authentica';
import { NotificationChannel } from './notification-channel';

/**
 * Raised when Authentica is not configured. OTP requests must fail closed:
 * reporting success while no SMS can be delivered leaves the caller waiting
 * for a code that will never arrive (and burns their hourly quota).
 */
export class SmsChannelNotConfiguredError extends ServiceUnavailableException {
  constructor() {
    super('SMS provider not configured. Configure Authentica before requesting SMS codes.');
  }
}

@Injectable()
export class SmsChannelAdapter implements NotificationChannel {
  private readonly logger = new Logger(SmsChannelAdapter.name);
  readonly kind = OtpChannel.SMS;

  constructor(private readonly authentica: AuthenticaClient) {}

  async send(identifier: string, code: string, _organizationId?: string): Promise<void> {
    if (!this.authentica.isConfigured()) {
      this.logger.error('SmsChannelAdapter: Authentica not configured; refusing to report a fake send');
      throw new SmsChannelNotConfiguredError();
    }

    try {
      await this.authentica.sendOtp({ channel: 'SMS', identifier, code });
    } catch (err) {
      this.logger.error('SmsChannelAdapter: OTP provider failure');
      throw err;
    }
  }
}
