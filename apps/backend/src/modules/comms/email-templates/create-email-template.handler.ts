import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { CreateEmailTemplateDto } from './create-email-template.dto';
import { renderBlocksToHtml } from './render-blocks';
import type { EmailBlock } from './email-block.types';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type CreateEmailTemplateCommand = CreateEmailTemplateDto;

@Injectable()
export class CreateEmailTemplateHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: CreateEmailTemplateCommand) {
    const _organizationId = DEFAULT_ORGANIZATION_ID;
    // SaaS-02f: slug uniqueness is now per-org (composite unique). The Proxy
    // auto-scopes `where` by organizationId, so findFirst by slug is safe.
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
