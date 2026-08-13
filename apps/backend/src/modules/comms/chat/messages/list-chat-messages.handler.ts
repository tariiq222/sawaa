import { Injectable, NotFoundException } from '@nestjs/common';
import { RlsTransactionService } from '../../../../infrastructure/database';
import { ChatAccessService } from '../guest/chat-access.service';
import { lockChatConversation } from '../conversation-lock.helper';
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
    private readonly access: ChatAccessService,
    private readonly rlsTransaction: RlsTransactionService,
  ) {}

  async execute(command: ListChatMessagesCommand): Promise<ListChatMessagesResult> {
    return this.rlsTransaction.withTransaction(async (tx) => {
      await lockChatConversation(tx, command.conversationId);
      const conversation = await tx.chatConversation.findFirst({
        where: command.audience === 'guest'
          ? {
            id: command.conversationId,
            clientId: null,
            guestTokenHash: this.access.guestTokenHash(command.guestToken),
          }
          : { id: command.conversationId, clientId: command.clientId },
        select: { id: true },
      });
      if (!conversation) throw new NotFoundException('Conversation not found');

      if (command.cursor) {
        const cursorMessage = await tx.commsChatMessage.findUnique({ where: { id: command.cursor } });
        if (!cursorMessage || cursorMessage.conversationId !== command.conversationId) {
          throw new NotFoundException('Message cursor not found');
        }
      }

      const limit = Math.min(Math.max(command.limit, 1), 100);
      const messages = await tx.commsChatMessage.findMany({
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
    });
  }
}
