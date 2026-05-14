import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { toListResponse } from '../../../common/dto';
import { ListConversationsDto } from './list-conversations.dto';

export type ListConversationsCommand = Omit<ListConversationsDto, 'page' | 'limit'> & {
  page: number;
  limit: number;
};

@Injectable()
export class ListConversationsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: ListConversationsCommand) {
    const where = {
      ...(cmd.clientId ? { clientId: cmd.clientId } : {}),
      ...(cmd.employeeId ? { employeeId: cmd.employeeId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.chatConversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip: (cmd.page - 1) * cmd.limit,
        take: cmd.limit,
        include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
      this.prisma.chatConversation.count({ where }),
    ]);

    return toListResponse(items, total, cmd.page, cmd.limit);
  }
}
