import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

export interface PlatformEmailTemplateRow {
  id: string;
  slug: string;
  name: string;
  subjectAr: string;
  subjectEn: string;
  htmlBody: string;
  blocks: unknown;
  isActive: boolean;
  isLocked: boolean;
  version: number;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type TemplateClient = {
  platformEmailTemplate: {
    findUnique: (args: { where: { slug: string } }) => Promise<PlatformEmailTemplateRow | null>;
  };
};

@Injectable()
export class GetPlatformEmailTemplateHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(slug: string): Promise<PlatformEmailTemplateRow> {
    const row = await (this.prisma as unknown as TemplateClient).platformEmailTemplate.findUnique({ where: { slug } });
    if (!row) throw new NotFoundException(`Template not found: ${slug}`);
    return row;
  }
}
