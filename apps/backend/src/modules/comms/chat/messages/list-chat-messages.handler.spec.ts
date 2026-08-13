import { ChatAccessService } from '../guest/chat-access.service';
import { PrismaService } from '../../../../infrastructure/database';
import { ListChatMessagesHandler } from './list-chat-messages.handler';

describe('ListChatMessagesHandler', () => {
  const access = { assertGuestAccess: jest.fn(), assertClientAccess: jest.fn() };
  const prisma = {
    commsChatMessage: { findUnique: jest.fn(), findMany: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    access.assertGuestAccess.mockResolvedValue({ id: 'conversation-1', status: 'CLOSED' });
    prisma.commsChatMessage.findUnique.mockResolvedValue({ id: 'message-2', conversationId: 'conversation-1' });
  });

  it('allows the owning guest to read a closed conversation and applies a stable createdAt/id cursor order', async () => {
    prisma.commsChatMessage.findMany.mockResolvedValue([
      { id: 'message-3', createdAt: new Date('2026-08-13T10:00:00.000Z') },
      { id: 'message-2', createdAt: new Date('2026-08-13T10:00:00.000Z') },
      { id: 'message-1', createdAt: new Date('2026-08-13T09:00:00.000Z') },
    ]);
    const handler = new ListChatMessagesHandler(prisma as unknown as PrismaService, access as unknown as ChatAccessService);

    const result = await handler.execute({
      audience: 'guest', conversationId: 'conversation-1', guestToken: 'guest-token', cursor: 'message-2', limit: 2,
    });

    expect(access.assertGuestAccess).toHaveBeenCalledWith('conversation-1', 'guest-token');
    expect(result.meta).toEqual({ limit: 2, hasMore: true, nextCursor: 'message-2' });
    expect(prisma.commsChatMessage.findMany).toHaveBeenCalledWith({
      where: { conversationId: 'conversation-1' },
      cursor: { id: 'message-2' },
      skip: 1,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 3,
    });
  });

  it('rejects a cursor from another conversation instead of treating it as an unscoped message key', async () => {
    prisma.commsChatMessage.findUnique.mockResolvedValue({ id: 'foreign-message', conversationId: 'conversation-2' });
    const handler = new ListChatMessagesHandler(prisma as unknown as PrismaService, access as unknown as ChatAccessService);

    await expect(handler.execute({
      audience: 'client', conversationId: 'conversation-1', clientId: 'client-a', cursor: 'foreign-message', limit: 20,
    })).rejects.toThrow('Message cursor not found');
    expect(prisma.commsChatMessage.findMany).not.toHaveBeenCalled();
  });
});
