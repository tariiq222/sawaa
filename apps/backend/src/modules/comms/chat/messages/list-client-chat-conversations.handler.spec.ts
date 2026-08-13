import { NotFoundException } from '@nestjs/common';
import { RlsTransactionService } from '../../../../infrastructure/database';
import { ListClientChatConversationsHandler } from './list-client-chat-conversations.handler';

describe('ListClientChatConversationsHandler', () => {
  const tx = {
    chatConversation: { findFirst: jest.fn(), findMany: jest.fn() },
  };
  const transaction = { withTransaction: jest.fn((work) => work(tx)) };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists only the authenticated client conversations, including closed history, with a safe last-message preview', async () => {
    tx.chatConversation.findMany.mockResolvedValue([
      {
        id: 'conversation-open', status: 'AI_ACTIVE', createdAt: new Date('2026-08-13T08:00:00.000Z'),
        updatedAt: new Date('2026-08-13T10:00:00.000Z'), lastMessageAt: new Date('2026-08-13T10:00:00.000Z'),
        messages: [{ body: '  موعدك   مؤكد  ', senderType: 'AI', kind: 'TEXT' }],
      },
      {
        id: 'conversation-closed', status: 'CLOSED', createdAt: new Date('2026-08-12T08:00:00.000Z'),
        updatedAt: new Date('2026-08-12T10:00:00.000Z'), lastMessageAt: null,
        messages: [],
      },
    ]);
    const handler = new ListClientChatConversationsHandler(transaction as unknown as RlsTransactionService);

    const result = await handler.execute({ clientId: 'client-a', limit: 20 });

    expect(tx.chatConversation.findMany).toHaveBeenCalledWith({
      where: { clientId: 'client-a' },
      select: {
        id: true, status: true, createdAt: true, updatedAt: true, lastMessageAt: true,
        messages: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, select: { body: true, senderType: true, kind: true } },
      },
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'desc' }],
      take: 21,
    });
    expect(result).toEqual({
      data: [
        {
          id: 'conversation-open', status: 'AI_ACTIVE', createdAt: new Date('2026-08-13T08:00:00.000Z'),
          updatedAt: new Date('2026-08-13T10:00:00.000Z'), lastMessageAt: new Date('2026-08-13T10:00:00.000Z'),
          lastMessage: { preview: 'موعدك مؤكد', senderType: 'AI', kind: 'TEXT' },
        },
        {
          id: 'conversation-closed', status: 'CLOSED', createdAt: new Date('2026-08-12T08:00:00.000Z'),
          updatedAt: new Date('2026-08-12T10:00:00.000Z'), lastMessageAt: null, lastMessage: null,
        },
      ],
      meta: { limit: 20, hasMore: false, nextCursor: null },
    });
  });

  it('requires the cursor to belong to the same client before using it', async () => {
    tx.chatConversation.findFirst.mockResolvedValue(null);
    const handler = new ListClientChatConversationsHandler(transaction as unknown as RlsTransactionService);

    await expect(handler.execute({ clientId: 'client-a', cursor: 'conversation-b', limit: 20 }))
      .rejects.toThrow(NotFoundException);

    expect(tx.chatConversation.findFirst).toHaveBeenCalledWith({
      where: { id: 'conversation-b', clientId: 'client-a' }, select: { id: true },
    });
    expect(tx.chatConversation.findMany).not.toHaveBeenCalled();
  });
});
