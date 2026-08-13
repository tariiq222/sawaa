import { ConversationStatus, MessageSenderType } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { MarkConversationReadHandler } from './mark-conversation-read.handler';

describe('MarkConversationReadHandler', () => {
  it('marks only owned visitor/client messages through an optional sequence and resets unread atomically', async () => {
    const prisma: any = {
      chatConversation: { findFirst: jest.fn().mockResolvedValue({ id: 'conv-1', status: ConversationStatus.STAFF_ACTIVE }) },
      commsChatMessage: { findFirst: jest.fn().mockResolvedValue({ sequence: 42n }) },
    };
    const tx: any = {
      commsChatMessage: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      chatConversation: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const transaction: any = { withTransaction: jest.fn().mockImplementation((work) => work(tx)) };
    const handler = new MarkConversationReadHandler(prisma as PrismaService, transaction as RlsTransactionService);

    await handler.execute({ conversationId: 'conv-1', staffUserId: 'staff-a', throughSequence: '42' });

    expect(prisma.chatConversation.findFirst).toHaveBeenCalledWith({
      where: { id: 'conv-1', status: ConversationStatus.STAFF_ACTIVE, assignedStaffUserId: 'staff-a' },
      select: { id: true },
    });
    expect(prisma.commsChatMessage.findFirst).toHaveBeenCalledWith({
      where: { conversationId: 'conv-1', sequence: 42n },
      select: { sequence: true },
    });
    expect(tx.commsChatMessage.updateMany).toHaveBeenCalledWith({
      where: {
        conversationId: 'conv-1',
        senderType: { in: [MessageSenderType.VISITOR, MessageSenderType.CLIENT] },
        isRead: false,
        sequence: { lte: 42n },
      },
      data: { isRead: true, readAt: expect.any(Date) },
    });
    expect(tx.chatConversation.updateMany).toHaveBeenCalledWith({
      where: { id: 'conv-1', status: ConversationStatus.STAFF_ACTIVE, assignedStaffUserId: 'staff-a' },
      data: { staffUnreadCount: 0 },
    });
  });

  it('resolves an owned message cursor to its sequence and rejects mixed cursor inputs', async () => {
    const prisma: any = {
      chatConversation: { findFirst: jest.fn().mockResolvedValue({ id: 'conv-1' }) },
      commsChatMessage: { findFirst: jest.fn().mockResolvedValue({ sequence: 9n }) },
    };
    const tx: any = {
      commsChatMessage: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      chatConversation: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const transaction: any = { withTransaction: jest.fn().mockImplementation((work) => work(tx)) };
    const handler = new MarkConversationReadHandler(prisma as PrismaService, transaction as RlsTransactionService);

    await handler.execute({ conversationId: 'conv-1', staffUserId: 'staff-a', throughMessageId: 'message-9' });
    expect(prisma.commsChatMessage.findFirst).toHaveBeenCalledWith({
      where: { id: 'message-9', conversationId: 'conv-1' },
      select: { sequence: true },
    });
    expect(tx.commsChatMessage.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ sequence: { lte: 9n } }),
    }));
    await expect(handler.execute({
      conversationId: 'conv-1', staffUserId: 'staff-a', throughMessageId: 'message-9', throughSequence: '9',
    })).rejects.toThrow('Provide either throughMessageId or throughSequence');
  });
});
