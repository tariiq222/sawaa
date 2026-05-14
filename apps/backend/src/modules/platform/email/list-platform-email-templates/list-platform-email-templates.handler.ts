import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

type PlatformEmailTemplateListItem = {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  isLocked: boolean;
  version: number;
  updatedAt: Date;
};

type TemplateClient = {
  platformEmailTemplate: {
    findMany: (args: {
      orderBy: { slug: string };
      select: Record<string, boolean>;
    }) => Promise<PlatformEmailTemplateListItem[]>;
  };
};

@Injectable()
export class ListPlatformEmailTemplatesHandler {
  constructor(private readonly prisma: PrismaService) {}

  execute(): Promise<PlatformEmailTemplateListItem[]> {
    return (this.prisma as unknown as TemplateClient).platformEmailTemplate.findMany({
      orderBy: { slug: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        isActive: true,
        isLocked: true,
        version: true,
        updatedAt: true,
      },
    });
  }
}
