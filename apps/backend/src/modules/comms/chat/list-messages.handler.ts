import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ListMessagesDto } from './list-messages.dto';

export type ListMessagesCommand = Omit<ListMessagesDto, 'limit'> & {
  conversationId: string;
  limit: number;
};

@Injectable()
export class ListMessagesHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: ListMessagesCommand) {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: { id: cmd.conversationId },
      select: { id: true },
    });
    if (!conversation) {
      throw new NotFoundException(`Conversation ${cmd.conversationId} not found`);
    }

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
