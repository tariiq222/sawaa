import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/database';
import { SmtpService } from '../../../infrastructure/mail';
import { EmailProviderFactory } from '../../../infrastructure/email/email-provider.factory';

import { SendEmailDto } from './send-email.dto';
import { DEFAULT_ORG_ID } from '../../../common/constants';

export type SendEmailCommand = SendEmailDto;

@Injectable()
export class SendEmailHandler {
  private readonly logger = new Logger(SendEmailHandler.name);

  constructor(
    private readonly smtp: SmtpService,
    private readonly prisma: PrismaService,
    private readonly emailFactory: EmailProviderFactory,
  ) {}

  async execute(dto: SendEmailCommand): Promise<void> {
    // organizationId kept as AES-GCM AAD for credential decryption via factory
    const organizationId = DEFAULT_ORG_ID;

    const template = await this.prisma.emailTemplate.findFirst({
      where: { slug: dto.templateSlug },
    });

    if (!template || !template.isActive) {
      this.logger.warn(`Email template "${dto.templateSlug}" not found`);
      return;
    }

    const html = this.interpolate(template.htmlBody, dto.vars);
    const subject = this.interpolate(template.subject, dto.vars);

    // Try per-tenant email provider first; fall back to platform SMTP.
    let useFallback = true;
    try {
      const tenantAdapter = await this.emailFactory.forCurrentTenant(organizationId);

      if (tenantAdapter.isAvailable()) {
        await tenantAdapter.sendMail({ to: dto.to, subject, html });
        return;
      }
    } catch {
      // Tenant config lookup failed — fall through to platform SMTP
    }

    if (useFallback) {
      await this.sendViaFallback(dto.to, subject, html);
    }
  }

  private async sendViaFallback(to: string, subject: string, html: string): Promise<void> {
    // Platform-level SMTP fallback
    if (!this.smtp.isAvailable()) {
      this.logger.warn('No email provider configured — skipping send to ' + to);
      return;
    }

    try {
      await this.smtp.sendMail(to, subject, html);
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}`, err);
    }
  }

  private interpolate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
  }
}
