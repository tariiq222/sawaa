import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CreateEmailTemplateDto } from './create-email-template.dto';
import { renderBlocksToHtml } from './render-blocks';
import type { EmailBlock } from './email-block.types';

export type CreateEmailTemplateCommand = CreateEmailTemplateDto;

@Injectable()
export class CreateEmailTemplateHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: CreateEmailTemplateCommand) {
    const existing = await this.prisma.emailTemplate.findFirst({
      where: { slug: cmd.slug },
    });
    if (existing) {
      throw new ConflictException(`Template "${cmd.slug}" already exists`);
    }

    let htmlBody = cmd.htmlBody;
    let blocks: EmailBlock[] | null = null;

    if (cmd.blocks !== undefined) {
      // Blocks is the source of truth — render htmlBody from blocks
      blocks = cmd.blocks as EmailBlock[];
      htmlBody = renderBlocksToHtml(blocks);
    }

    return this.prisma.emailTemplate.create({
      data: {
        slug: cmd.slug,
        name: cmd.name,
        subject: cmd.subject,
        htmlBody,
        blocks: blocks ?? undefined,
      },
    });
  }
}
