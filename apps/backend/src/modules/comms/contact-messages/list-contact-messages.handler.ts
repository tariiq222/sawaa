import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { toListResponse } from '../../../common/dto';
import { ListContactMessagesDto } from './list-contact-messages.dto';

export type ListContactMessagesQuery = ListContactMessagesDto & { page: number; limit: number };

@Injectable()
export class ListContactMessagesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListContactMessagesQuery) {
    const where = query.status ? { status: query.status } : {};
    const [items, total] = await Promise.all([
      this.prisma.contactMessage.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contactMessage.count({ where }),
    ]);
    return toListResponse(items, total, query.page, query.limit);
  }
}
