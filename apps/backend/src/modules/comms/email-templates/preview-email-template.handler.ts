import { Injectable, NotFoundException } from '@nestjs/common';
import { escapeHtml } from '../../../common/security/escape-html';
import { PrismaService } from '../../../infrastructure/database';

export interface PreviewEmailTemplateCommand {
  id: string;
  context: Record<string, unknown>;
}

@Injectable()
export class PreviewEmailTemplateHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: PreviewEmailTemplateCommand): Promise<{ subject: string; body: string }> {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { id: cmd.id },
    });

    if (!template) {
      throw new NotFoundException('Email template not found');
    }

    // Body is rendered as HTML, so context values are escaped to block XSS in
    // the preview (COMMS-001). The subject is plain text — left un-escaped so
    // the previewer does not see HTML entities.
    const interpolateHtml = (str: string): string =>
      str.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
        escapeHtml(String(cmd.context[key] ?? '')),
      );
    const interpolateText = (str: string): string =>
      str.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
        String(cmd.context[key] ?? ''),
      );

    return {
      subject: interpolateText(template.subject),
      body: interpolateHtml(template.htmlBody),
    };
  }
}
