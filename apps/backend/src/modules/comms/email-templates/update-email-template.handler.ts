import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { UpdateEmailTemplateDto } from './update-email-template.dto';
import { renderBlocksToHtml } from './render-blocks';
import type { EmailBlock } from './email-block.types';

export type UpdateEmailTemplateCommand = UpdateEmailTemplateDto & {
  id: string;
};

@Injectable()
export class UpdateEmailTemplateHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: UpdateEmailTemplateCommand) {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { id: cmd.id },
    });
    if (!template) {
      throw new NotFoundException(`Email template ${cmd.id} not found`);
    }

    const updates: Record<string, unknown> = {};
    if (cmd.name !== undefined) updates.name = cmd.name;
    if (cmd.subject !== undefined) updates.subject = cmd.subject;
    if (cmd.isActive !== undefined) updates.isActive = cmd.isActive;

    if (cmd.blocks !== undefined) {
      // Blocks is the source of truth — render htmlBody from it
      const blocks = cmd.blocks as EmailBlock[];
      updates.blocks = blocks;
      updates.htmlBody = renderBlocksToHtml(blocks);
    } else if (cmd.htmlBody !== undefined) {
      // Legacy raw-HTML edit — clear blocks since they no longer match
      updates.htmlBody = cmd.htmlBody;
      updates.blocks = null;
    }

    return this.prisma.emailTemplate.update({ where: { id: cmd.id }, data: updates });
  }
}
