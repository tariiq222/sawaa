import { NotFoundException } from '@nestjs/common';
import { ListMessagesHandler } from './list-messages.handler';
import type { PrismaService } from '../../../infrastructure/database';

const buildPrisma = () => ({
  chatConversation: {
    findFirst: jest.fn().mockResolvedValue(null),
  },
  commsChatMessage: {
    findMany: jest.fn().mockResolvedValue([]),
  },
});

describe('ListMessagesHandler', () => {
  it('throws NotFoundException when conversation does not exist', async () => {
    const prisma = buildPrisma();
    prisma.chatConversation.findFirst.mockResolvedValue(null);
    const handler = new ListMessagesHandler(prisma as unknown as PrismaService);
    await expect(
      handler.execute({ conversationId: 'missing', limit: 20 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns messages newest-first without cursor on first load', async () => {
    const prisma = buildPrisma();
    prisma.chatConversation.findFirst.mockResolvedValue({ id: 'conv-1' });
    prisma.commsChatMessage.findMany.mockResolvedValue([
      { id: 'msg-3' }, { id: 'msg-2' }, { id: 'msg-1' },
    ]);
    const handler = new ListMessagesHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({ conversationId: 'conv-1', limit: 20 });
    expect(result.data).toHaveLength(3);
    expect(result.meta.hasMore).toBe(false);
    expect(result.meta.nextCursor).toBeNull();
    expect(prisma.commsChatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' }, take: 21 }),
    );
  });

  it('sets hasMore and nextCursor when more messages exist', async () => {
    const prisma = buildPrisma();
    prisma.chatConversation.findFirst.mockResolvedValue({ id: 'conv-1' });
    prisma.commsChatMessage.findMany.mockResolvedValue([
      { id: 'msg-3' }, { id: 'msg-2' }, { id: 'msg-1' },
    ]);
    const handler = new ListMessagesHandler(prisma as unknown as PrismaService);
    const result = await handler.execute({ conversationId: 'conv-1', limit: 2 });
    expect(result.data).toHaveLength(2);
    expect(result.meta.hasMore).toBe(true);
    expect(result.meta.nextCursor).toBe('msg-2');
  });

  it('applies cursor pagination to load older messages', async () => {
    const prisma = buildPrisma();
    prisma.chatConversation.findFirst.mockResolvedValue({ id: 'conv-1' });
    prisma.commsChatMessage.findMany.mockResolvedValue([]);
    const handler = new ListMessagesHandler(prisma as unknown as PrismaService);
    await handler.execute({ conversationId: 'conv-1', cursor: 'msg-5', limit: 20 });
    expect(prisma.commsChatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'msg-5' }, skip: 1 }),
    );
  });
});
