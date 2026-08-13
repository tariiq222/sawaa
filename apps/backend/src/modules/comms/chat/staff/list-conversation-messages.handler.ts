import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { toChatMessageResponse, type ChatMessageResponse } from '../messages/chat-message.mapper';
import { StaffConversationAccessService } from './staff-conversation-access.service';

export interface ListConversationMessagesCommand {
  conversationId: string;
  staffUserId: string;
  staffRole: string | null | undefined;
  cursor?: string;
  limit: number;
}

@Injectable()
export class ListConversationMessagesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StaffConversationAccessService,
  ) {}

  async execute(command: ListConversationMessagesCommand): Promise<{
    data: ChatMessageResponse[];
    meta: { limit: number; nextCursor: string | null; hasMore: boolean };
  }> {
    await this.access.assertReadAccess(command.conversationId, command.staffUserId, command.staffRole);
    if (command.cursor) {
      const cursor = await this.prisma.commsChatMessage.findUnique({ where: { id: command.cursor } });
      if (!cursor || cursor.conversationId !== command.conversationId) {
        throw new NotFoundException('Message cursor not found');
      }
    }
    const limit = Math.min(Math.max(command.limit, 1), 100);
    const rows = await this.prisma.commsChatMessage.findMany({
      where: { conversationId: command.conversationId },
      ...(command.cursor ? { cursor: { id: command.cursor }, skip: 1 } : {}),
      orderBy: [{ sequence: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const data = (hasMore ? rows.slice(0, limit) : rows).map(toChatMessageResponse);
    return { data, meta: { limit, hasMore, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null } };
  }
}
