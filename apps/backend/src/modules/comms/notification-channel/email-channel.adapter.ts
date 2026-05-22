// email-channel-adapter — sends OTP/verification emails via the single
// tenant-configured email provider. No fallbacks: if the provider is
// missing or fails, we throw so the caller surfaces a clear error.

import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { EmailProviderFactory } from '../../../infrastructure/email/email-provider.factory';
import { NotificationChannel } from './notification-channel';

// Must match OTP_EXPIRY_MINUTES in request-dashboard-otp.handler.ts (5 min).
const OTP_EXPIRY_MINUTES = 5;

const OTP_SUBJECT = 'رمز التحقق / Verification Code';

const buildOtpHtml = (code: string) => `
  <div dir="rtl" style="font-family:'IBM Plex Sans Arabic',Arial,sans-serif;text-align:center;padding:40px 20px;">
    <h2 style="color:#354FD8;margin-bottom:24px;">رمز التحقق</h2>
    <p style="font-size:18px;color:#333;">استخدم الرمز التالي:</p>
    <div style="background:#F5F7FA;border-radius:12px;padding:24px;margin:24px 0;">
      <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#354FD8;">${code}</span>
    </div>
    <p style="font-size:14px;color:#888;">سينتهي هذا الرمز خلال ${OTP_EXPIRY_MINUTES} دقائق</p>
  </div>
  <div dir="ltr" style="font-family:Arial,sans-serif;text-align:center;padding:20px;border-top:1px solid #eee;margin-top:20px;">
    <h2 style="color:#354FD8;margin-bottom:24px;">Your Verification Code</h2>
    <p style="font-size:18px;color:#333;">Use the following code:</p>
    <div style="background:#F5F7FA;border-radius:12px;padding:24px;margin:24px 0;">
      <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#354FD8;">${code}</span>
    </div>
    <p style="font-size:14px;color:#888;">This code expires in ${OTP_EXPIRY_MINUTES} minutes</p>
  </div>`;

@Injectable()
export class EmailChannelAdapter implements NotificationChannel {
  private readonly logger = new Logger(EmailChannelAdapter.name);

  readonly kind = 'EMAIL' as const;

  constructor(private readonly emailFactory: EmailProviderFactory) {}

  async send(identifier: string, message: string): Promise<void> {
    const html = buildOtpHtml(message);

    const adapter = await this.emailFactory.resolve();

    if (!adapter.isAvailable()) {
      this.logger.error(
        `Cannot send OTP to ${identifier}: no email provider configured`,
      );
      throw new ServiceUnavailableException(
        'Email provider not configured. Configure one in Settings → Email.',
      );
    }

    try {
      await adapter.sendMail({ to: identifier, subject: OTP_SUBJECT, html });
      this.logger.debug(`OTP email sent to ${identifier} via ${adapter.name}`);
    } catch (err) {
      this.logger.error(`Failed to send OTP to ${identifier} via ${adapter.name}`, err);
      throw err;
    }
  }
}
