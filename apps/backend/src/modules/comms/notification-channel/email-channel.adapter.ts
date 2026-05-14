// email-channel-adapter — sends OTP/notification emails.
//
// Priority (in order):
//   1. Tenant's configured provider (Resend / SendGrid / Mailchimp / SMTP)
//      — only when organizationId is supplied and a provider is configured.
//   2. PlatformMailerService (Resend via BullMQ) — for platform-level flows
//      where no organizationId is present (e.g. dashboard OTP before sign-in),
//      and as the primary fallback when the tenant provider is unavailable.
//   3. Platform SMTP (SmtpService) — last resort if PlatformMailerService throws
//      (e.g. queue unavailable / Resend API key missing).
//
// Tenant path (step 1) is completely unchanged.

import { Injectable, Logger } from '@nestjs/common';
import { SmtpService, PlatformMailerService } from '../../../infrastructure/mail';
import { EmailProviderFactory } from '../../../infrastructure/email/email-provider.factory';
import { NotificationChannel } from './notification-channel';

// Must match OTP_EXPIRY_MINUTES in request-dashboard-otp.handler.ts (5 min).
const PLATFORM_OTP_EXPIRY_MINUTES = 5;

const OTP_SUBJECT = 'رمز التحقق / Verification Code';

const buildOtpHtml = (code: string) => `
  <div dir="rtl" style="font-family:'IBM Plex Sans Arabic',Arial,sans-serif;text-align:center;padding:40px 20px;">
    <h2 style="color:#354FD8;margin-bottom:24px;">رمز التحقق من دقّة</h2>
    <p style="font-size:18px;color:#333;">استخدم الرمز التالي:</p>
    <div style="background:#F5F7FA;border-radius:12px;padding:24px;margin:24px 0;">
      <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#354FD8;">${code}</span>
    </div>
    <p style="font-size:14px;color:#888;">سينتهي هذا الرمز خلال 10 دقائق</p>
  </div>
  <div dir="ltr" style="font-family:Arial,sans-serif;text-align:center;padding:20px;border-top:1px solid #eee;margin-top:20px;">
    <h2 style="color:#354FD8;margin-bottom:24px;">Your Verification Code</h2>
    <p style="font-size:18px;color:#333;">Use the following code:</p>
    <div style="background:#F5F7FA;border-radius:12px;padding:24px;margin:24px 0;">
      <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#354FD8;">${code}</span>
    </div>
    <p style="font-size:14px;color:#888;">This code expires in 10 minutes</p>
  </div>`;

@Injectable()
export class EmailChannelAdapter implements NotificationChannel {
  private readonly logger = new Logger(EmailChannelAdapter.name);

  readonly kind = 'EMAIL' as const;

  constructor(
    private readonly smtp: SmtpService,
    private readonly emailFactory: EmailProviderFactory,
    private readonly platformMailer: PlatformMailerService,
  ) {}

  async send(
    identifier: string,
    message: string,
    organizationId?: string,
  ): Promise<void> {
    const html = buildOtpHtml(message);

    // ── 1. Tenant provider (if org is known and has a configured provider) ──
    if (organizationId) {
      try {
        const adapter = await this.emailFactory.forCurrentTenant(organizationId);
        if (adapter.isAvailable()) {
          await adapter.sendMail({ to: identifier, subject: OTP_SUBJECT, html });
          this.logger.debug(`OTP email sent via tenant provider to ${identifier} (org: ${organizationId})`);
          return;
        }
      } catch (err) {
        // Tenant config lookup failed — fall through to platform Resend
        this.logger.warn(`Tenant email provider lookup failed for org ${organizationId}: ${String(err)}`);
      }
    }

    // ── 2. Platform Resend (PlatformMailerService) ────────────────────────
    try {
      await this.platformMailer.sendOtpLogin(identifier, {
        code: message,
        expiresInMinutes: PLATFORM_OTP_EXPIRY_MINUTES,
      });
      this.logger.debug(`OTP email sent via platform Resend to ${identifier}`);
      return;
    } catch (err) {
      // Queue unavailable or Resend key missing — fall through to SMTP last resort
      this.logger.warn(`Platform Resend sendOtpLogin failed for ${identifier}: ${String(err)}`);
    }

    // ── 3. Platform SMTP (last resort) ────────────────────────────────────
    if (!this.smtp.isAvailable()) {
      this.logger.warn(`No email transport available — skipping OTP email to ${identifier}`);
      return;
    }

    try {
      await this.smtp.sendMail(identifier, OTP_SUBJECT, html);
      this.logger.debug(`OTP email sent via platform SMTP to ${identifier}`);
    } catch (err) {
      this.logger.error(`Failed to send OTP email to ${identifier}`, err);
      throw err;
    }
  }
}
