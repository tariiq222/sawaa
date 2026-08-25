import { Injectable, NotFoundException } from '@nestjs/common';
import type { ChatMessageKind, ConversationStatus, MessageSenderType, Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../../../infrastructure/database';

export interface ListClientChatConversationsCommand {
  clientId: string;
  cursor?: string;
  limit: number;
}

export interface ClientChatConversationSummary {
  id: string;
  status: ConversationStatus;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date | null;
  lastMessage: { preview: string; senderType: MessageSenderType; kind: ChatMessageKind } | null;
}

export interface ListClientChatConversationsResult {
  data: ClientChatConversationSummary[];
  meta: { limit: number; nextCursor: string | null; hasMore: boolean };
}

const CLIENT_CONVERSATION_SELECT: Prisma.ChatConversationSelect = {
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  lastMessageAt: true,
  messages: {
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: { body: true, senderType: true, kind: true },
  },
};

@Injectable()
export class ListClientChatConversationsHandler {
  constructor(private readonly rlsTransaction: RlsTransactionService) {}

  async execute(command: ListClientChatConversationsCommand): Promise<ListClientChatConversationsResult> {
    return this.rlsTransaction.withTransaction(async (tx) => {
      if (command.cursor) {
        const cursor = await tx.chatConversation.findFirst({
          where: { id: command.cursor, clientId: command.clientId },
          select: { id: true },
        });
        if (!cursor) throw new NotFoundException('Conversation cursor not found');
      }

      const limit = Math.min(Math.max(command.limit, 1), 100);
      const rows = await tx.chatConversation.findMany({
        where: { clientId: command.clientId },
        select: CLIENT_CONVERSATION_SELECT,
        orderBy: [
          { lastMessageAt: { sort: 'desc', nulls: 'last' } },
          { createdAt: 'desc' },
          { id: 'desc' },
        ],
        ...(command.cursor ? { cursor: { id: command.cursor }, skip: 1 } : {}),
        take: limit + 1,
      });
      const hasMore = rows.length > limit;
      const data = (hasMore ? rows.slice(0, limit) : rows).map((row): ClientChatConversationSummary => {
        const message = row.messages[0];
        return {
          id: row.id,
          status: row.status,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          lastMessageAt: row.lastMessageAt,
          lastMessage: message
            ? { preview: safePreview(message.body), senderType: message.senderType, kind: message.kind }
            : null,
        };
      });
      return { data, meta: { limit, hasMore, nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null } };
    });
  }
}

function safePreview(body: string): string {
  return Array.from(body.replace(/\s+/g, ' ').trim()).slice(0, 160).join('');
}
