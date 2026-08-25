import { ConversationStatus, MessageSenderType } from '@prisma/client';
import { RlsTransactionService } from '../../../../infrastructure/database';
import { MarkConversationReadHandler } from './mark-conversation-read.handler';

describe('MarkConversationReadHandler', () => {
  it('marks only owned visitor/client messages through an optional sequence and resets unread atomically', async () => {
    const tx: any = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      commsChatMessage: {
        findFirst: jest.fn().mockResolvedValue({ sequence: 42n }),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        count: jest.fn().mockResolvedValue(1),
      },
      chatConversation: {
        findFirst: jest.fn().mockResolvedValue({ id: 'conv-1', status: ConversationStatus.STAFF_ACTIVE }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const transaction: any = { withTransaction: jest.fn().mockImplementation((work) => work(tx)) };
    const handler = new MarkConversationReadHandler(transaction as RlsTransactionService);

    await handler.execute({ conversationId: 'conv-1', staffUserId: 'staff-a', throughSequence: '42' });

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.chatConversation.findFirst.mock.invocationCallOrder[0]);
    expect(tx.chatConversation.findFirst).toHaveBeenCalledWith({
      where: { id: 'conv-1', status: ConversationStatus.STAFF_ACTIVE, assignedStaffUserId: 'staff-a' },
      select: { id: true },
    });
    expect(tx.commsChatMessage.findFirst).toHaveBeenCalledWith({
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
      data: { staffUnreadCount: 1 },
    });
  });

  it('resolves an owned message cursor to its sequence and rejects mixed cursor inputs', async () => {
    const tx: any = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      commsChatMessage: {
        findFirst: jest.fn().mockResolvedValue({ sequence: 9n }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(0),
      },
      chatConversation: {
        findFirst: jest.fn().mockResolvedValue({ id: 'conv-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const transaction: any = { withTransaction: jest.fn().mockImplementation((work) => work(tx)) };
    const handler = new MarkConversationReadHandler(transaction as RlsTransactionService);

    await handler.execute({ conversationId: 'conv-1', staffUserId: 'staff-a', throughMessageId: 'message-9' });
    expect(tx.commsChatMessage.findFirst).toHaveBeenCalledWith({
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

  it('keeps a newer concurrently arrived inbound message unread in the exact counter', async () => {
    const tx: any = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      commsChatMessage: {
        findFirst: jest.fn().mockResolvedValue({ sequence: 5n }),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        count: jest.fn().mockResolvedValue(1),
      },
      chatConversation: { findFirst: jest.fn().mockResolvedValue({ id: 'conv-1' }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const transaction: any = { withTransaction: jest.fn().mockImplementation((work) => work(tx)) };
    const handler = new MarkConversationReadHandler(transaction as RlsTransactionService);
    await handler.execute({ conversationId: 'conv-1', staffUserId: 'staff-a', throughSequence: '5' });
    expect(tx.commsChatMessage.count).toHaveBeenCalledWith({
      where: { conversationId: 'conv-1', senderType: { in: [MessageSenderType.VISITOR, MessageSenderType.CLIENT] }, isRead: false },
    });
    expect(tx.chatConversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { staffUnreadCount: 1 } }));
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
