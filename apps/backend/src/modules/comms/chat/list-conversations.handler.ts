import { Injectable } from '@nestjs/common';
import { ConversationStatus } from '@prisma/client';
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

    const [rows, total] = await Promise.all([
      this.prisma.chatConversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip: (cmd.page - 1) * cmd.limit,
        take: cmd.limit,
        include: { _count: { select: { messages: true } } },
      }),
      this.prisma.chatConversation.count({ where }),
    ]);

    const clientIds = [...new Set(rows.map((r) => r.clientId))];
    const clients = await this.prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const clientById = new Map(clients.map((c) => [c.id, c]));

    const items = rows.map((row) => {
      const client = clientById.get(row.clientId);
      return {
        id: row.id,
        clientId: row.clientId,
        employeeId: row.employeeId,
        handedOff: row.employeeId != null,
        startedAt: row.createdAt,
        endedAt: row.status === ConversationStatus.CLOSED ? row.updatedAt : null,
        lastMessageAt: row.lastMessageAt,
        user: {
          id: row.clientId,
          firstName: client?.firstName ?? '',
          lastName: client?.lastName ?? '',
        },
        _count: { messages: row._count.messages },
      };
    });

    return toListResponse(items, total, cmd.page, cmd.limit);
  }
}
