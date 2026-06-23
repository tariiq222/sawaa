import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

import { escapeHtml } from '../../../common/security/escape-html';
import { PrismaService } from '../../../infrastructure/database';
import { EmailProviderFactory } from '../../../infrastructure/email/email-provider.factory';

import { SendEmailDto } from './send-email.dto';

export type SendEmailCommand = SendEmailDto;

@Injectable()
export class SendEmailHandler {
  private readonly logger = new Logger(SendEmailHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailFactory: EmailProviderFactory,
  ) {}

  async execute(dto: SendEmailCommand): Promise<void> {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { slug: dto.templateSlug },
    });

    if (!template || !template.isActive) {
      this.logger.warn(`Email template "${dto.templateSlug}" not found`);
      return;
    }

    const html = this.interpolateHtml(template.htmlBody, dto.vars);
    const subject = this.interpolateText(template.subject, dto.vars);

    const adapter = await this.emailFactory.resolve();

    if (!adapter.isAvailable()) {
      this.logger.error(
        `Cannot send "${dto.templateSlug}" to ${dto.to}: no email provider configured`,
      );
      throw new ServiceUnavailableException(
        'Email provider not configured. Configure one in Settings → Email.',
      );
    }

    try {
      await adapter.sendMail({ to: dto.to, subject, html });
    } catch (err) {
      this.logger.error(`Failed to send "${dto.templateSlug}" to ${dto.to}`, err);
      throw err;
    }
  }

  /**
   * Interpolate into an HTML context. Variable values are HTML-escaped so a
   * malicious value (e.g. a client name of `<script>…`) cannot inject markup
   * into the rendered email (COMMS-001 stored XSS).
   */
  private interpolateHtml(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => escapeHtml(vars[key] ?? ''));
  }

  /**
   * Interpolate into a plain-text context (the email subject). No escaping —
   * the subject is never rendered as HTML, so entities would leak to the user.
   */
  private interpolateText(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
  }
}
