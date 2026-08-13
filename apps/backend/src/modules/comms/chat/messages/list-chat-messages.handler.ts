import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { ChatAccessService } from '../guest/chat-access.service';
import { toChatMessageResponse, type ChatMessageResponse } from './chat-message.mapper';

export type ListChatMessagesCommand =
  | { audience: 'guest'; conversationId: string; guestToken: string; cursor?: string; limit: number }
  | { audience: 'client'; conversationId: string; clientId: string; cursor?: string; limit: number };

export interface ListChatMessagesResult {
  data: ChatMessageResponse[];
  meta: { limit: number; nextCursor: string | null; hasMore: boolean };
}

@Injectable()
export class ListChatMessagesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ChatAccessService,
  ) {}

  async execute(command: ListChatMessagesCommand): Promise<ListChatMessagesResult> {
    if (command.audience === 'guest') {
      await this.access.assertGuestAccess(command.conversationId, command.guestToken);
    } else {
      await this.access.assertClientAccess(command.conversationId, command.clientId);
    }

    if (command.cursor) {
      const cursorMessage = await this.prisma.commsChatMessage.findUnique({ where: { id: command.cursor } });
      if (!cursorMessage || cursorMessage.conversationId !== command.conversationId) {
        throw new NotFoundException('Message cursor not found');
      }
    }

    const limit = Math.min(Math.max(command.limit, 1), 100);
    const messages = await this.prisma.commsChatMessage.findMany({
      where: { conversationId: command.conversationId },
      ...(command.cursor ? { cursor: { id: command.cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const hasMore = messages.length > limit;
    const data = (hasMore ? messages.slice(0, limit) : messages).map(toChatMessageResponse);

    return {
      data,
      meta: {
        limit,
        nextCursor: hasMore ? data[data.length - 1].id : null,
        hasMore,
      },
    };
  }
}
