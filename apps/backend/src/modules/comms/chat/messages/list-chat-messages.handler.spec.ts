import { ChatAccessService } from '../guest/chat-access.service';
import { RlsTransactionService } from '../../../../infrastructure/database';
import { ListChatMessagesHandler } from './list-chat-messages.handler';

describe('ListChatMessagesHandler', () => {
  const access = {
    assertGuestAccess: jest.fn(),
    assertClientAccess: jest.fn(),
    guestTokenHash: jest.fn(),
  };
  const tx = {
    $executeRaw: jest.fn(),
    chatConversation: { findFirst: jest.fn() },
    commsChatMessage: { findUnique: jest.fn(), findMany: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    access.guestTokenHash.mockReturnValue('guest-hash');
    tx.chatConversation.findFirst.mockResolvedValue({ id: 'conversation-1' });
    tx.commsChatMessage.findUnique.mockResolvedValue({ id: 'message-2', conversationId: 'conversation-1' });
  });

  it('allows the owning guest to read a closed conversation and applies a stable createdAt/id cursor order', async () => {
    tx.commsChatMessage.findMany.mockResolvedValue([
      { id: 'message-3', createdAt: new Date('2026-08-13T10:00:00.000Z') },
      { id: 'message-2', createdAt: new Date('2026-08-13T10:00:00.000Z') },
      { id: 'message-1', createdAt: new Date('2026-08-13T09:00:00.000Z') },
    ]);
    const handler = new ListChatMessagesHandler(
      access as unknown as ChatAccessService,
      { withTransaction: jest.fn((work) => work(tx)) } as unknown as RlsTransactionService,
    );

    const result = await handler.execute({
      audience: 'guest', conversationId: 'conversation-1', guestToken: 'guest-token', cursor: 'message-2', limit: 2,
    });

    expect(tx.chatConversation.findFirst).toHaveBeenCalledWith({
      where: { id: 'conversation-1', clientId: null, guestTokenHash: 'guest-hash' },
      select: { id: true },
    });
    expect(result.meta).toEqual({ limit: 2, hasMore: true, nextCursor: 'message-2' });
    expect(tx.commsChatMessage.findMany).toHaveBeenCalledWith({
      where: { conversationId: 'conversation-1' },
      cursor: { id: 'message-2' },
      skip: 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 3,
    });
  });

  it('rejects a cursor from another conversation instead of treating it as an unscoped message key', async () => {
    tx.commsChatMessage.findUnique.mockResolvedValue({ id: 'foreign-message', conversationId: 'conversation-2' });
    const handler = new ListChatMessagesHandler(
      access as unknown as ChatAccessService,
      { withTransaction: jest.fn((work) => work(tx)) } as unknown as RlsTransactionService,
    );

    await expect(handler.execute({
      audience: 'client', conversationId: 'conversation-1', clientId: 'client-a', cursor: 'foreign-message', limit: 20,
    })).rejects.toThrow('Message cursor not found');
    expect(tx.commsChatMessage.findMany).not.toHaveBeenCalled();
  });

  it('reads client message history only after the locked owner predicate matches the authenticated client', async () => {
    tx.commsChatMessage.findMany.mockResolvedValue([]);
    const handler = new ListChatMessagesHandler(
      access as unknown as ChatAccessService,
      { withTransaction: jest.fn((work) => work(tx)) } as unknown as RlsTransactionService,
    );

    await handler.execute({ audience: 'client', conversationId: 'conversation-1', clientId: 'client-a', limit: 20 });

    expect(tx.chatConversation.findFirst).toHaveBeenCalledWith({
      where: { id: 'conversation-1', clientId: 'client-a' }, select: { id: true },
    });
  });

  it('does not read messages after a guest claim wins the shared conversation lock', async () => {
    tx.chatConversation.findFirst.mockResolvedValue(null);
    const handler = new ListChatMessagesHandler(
      access as unknown as ChatAccessService,
      { withTransaction: jest.fn((work) => work(tx)) } as unknown as RlsTransactionService,
    );

    await expect(handler.execute({
      audience: 'guest', conversationId: 'conversation-1', guestToken: 'old-token', limit: 20,
    })).rejects.toThrow('Conversation not found');
    expect(tx.commsChatMessage.findMany).not.toHaveBeenCalled();
  });
});
