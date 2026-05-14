import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { toListResponse } from '../../../common/dto';
import { ListEmailTemplatesDto } from './list-email-templates.dto';

export type ListEmailTemplatesCommand = Omit<ListEmailTemplatesDto, 'page' | 'limit'> & {
  page: number;
  limit: number;
};

@Injectable()
export class ListEmailTemplatesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: ListEmailTemplatesCommand) {
    const [items, total] = await Promise.all([
      this.prisma.emailTemplate.findMany({
        where: {},
        orderBy: { createdAt: 'asc' },
        skip: (cmd.page - 1) * cmd.limit,
        take: cmd.limit,
      }),
      this.prisma.emailTemplate.count(),
    ]);
    return toListResponse(items, total, cmd.page, cmd.limit);
  }
}
