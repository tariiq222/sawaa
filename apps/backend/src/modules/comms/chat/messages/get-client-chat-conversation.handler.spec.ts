import { NotFoundException } from '@nestjs/common';
import { RlsTransactionService } from '../../../../infrastructure/database';
import { GetClientChatConversationHandler } from './get-client-chat-conversation.handler';

describe('GetClientChatConversationHandler', () => {
  const tx = { chatConversation: { findFirst: jest.fn() } };

  beforeEach(() => jest.clearAllMocks());

  it('returns only the requested conversation when the authenticated client owns it', async () => {
    tx.chatConversation.findFirst.mockResolvedValue({
      id: 'conversation-a', isAiChat: true, status: 'AI_ACTIVE', language: 'ar',
      createdAt: new Date('2026-08-14T00:00:00.000Z'), updatedAt: new Date('2026-08-14T00:01:00.000Z'),
    });
    const handler = new GetClientChatConversationHandler({ withTransaction: jest.fn((work) => work(tx)) } as unknown as RlsTransactionService);

    await expect(handler.execute({ clientId: 'client-a', conversationId: 'conversation-a' })).resolves.toEqual({
      id: 'conversation-a', isAiChat: true, status: 'AI_ACTIVE', language: 'ar',
      createdAt: new Date('2026-08-14T00:00:00.000Z'), updatedAt: new Date('2026-08-14T00:01:00.000Z'),
    });
    expect(tx.chatConversation.findFirst).toHaveBeenCalledWith({
      where: { id: 'conversation-a', clientId: 'client-a' },
      select: { id: true, isAiChat: true, status: true, language: true, createdAt: true, updatedAt: true },
    });
  });

  it('returns not found for an unowned conversation without probing its identity', async () => {
    tx.chatConversation.findFirst.mockResolvedValue(null);
    const handler = new GetClientChatConversationHandler({ withTransaction: jest.fn((work) => work(tx)) } as unknown as RlsTransactionService);

    await expect(handler.execute({ clientId: 'client-a', conversationId: 'conversation-b' })).rejects.toThrow(NotFoundException);
  });
});
