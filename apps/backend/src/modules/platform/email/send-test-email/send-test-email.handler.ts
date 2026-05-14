import { Injectable, Logger } from '@nestjs/common';
import { PlatformMailerService } from '../../../../infrastructure/mail/platform-mailer.service';
import { PreviewPlatformEmailTemplateHandler } from '../preview-platform-email-template/preview-platform-email-template.handler';
import { SendTestEmailDto } from './send-test-email.dto';

export interface SendTestEmailResult {
  ok: boolean;
  reason?: string;
}

@Injectable()
export class SendTestEmailHandler {
  private readonly logger = new Logger(SendTestEmailHandler.name);

  constructor(
    private readonly preview: PreviewPlatformEmailTemplateHandler,
    private readonly mailer: PlatformMailerService,
  ) {}

  async execute(dto: SendTestEmailDto): Promise<SendTestEmailResult> {
    try {
      const { subject, html } = await this.preview.execute(dto.slug, dto.vars ?? {});
      await this.mailer.sendRaw({
        to: dto.to,
        subject,
        html,
        templateSlug: `${dto.slug}#test`,
      });
      return { ok: true };
    } catch (err) {
      this.logger.error(`SendTestEmail failed for ${dto.slug}`, err);
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }
  }
}
