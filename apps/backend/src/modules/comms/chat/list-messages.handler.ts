import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ListMessagesDto } from './list-messages.dto';
import { assertConversationAccess } from './assert-conversation-access.helper';

export type ListMessagesCommand = Omit<ListMessagesDto, 'limit'> & {
  requesterRole?: string | null;
  requesterUserId?: string;
  conversationId: string;
  limit: number;
  // SECURITY (P0-4): when present, restricts access to the caller's conversation only.
  // Required for client surfaces; dashboard staff additionally supply their actor.
  clientId?: string;
};

@Injectable()
export class ListMessagesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: ListMessagesCommand) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: {
        id: cmd.conversationId,
        ...(cmd.clientId ? { clientId: cmd.clientId } : {}),
      },
      select: { id: true, employeeId: true },
    });
    if (!conversation) {
      throw new NotFoundException(`Conversation ${cmd.conversationId} not found`);
    }

    await assertConversationAccess(this.prisma, conversation, cmd);

    // Cursor-based pagination: fetch `limit + 1` to detect if more pages exist.
    // Ordered newest-first so mobile can load older messages as user scrolls up.
    const take = cmd.limit + 1;
    const messages = await this.prisma.commsChatMessage.findMany({
      where: {
        conversationId: cmd.conversationId,
      },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cmd.cursor
        ? { cursor: { id: cmd.cursor }, skip: 1 } // skip the cursor itself
        : {}),
    });

    const hasMore = messages.length > cmd.limit;
    const data = hasMore ? messages.slice(0, cmd.limit) : messages;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return {
      data,
      meta: {
        limit: cmd.limit,
        nextCursor,
        hasMore,
      },
    };
  }
}
