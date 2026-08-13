import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ConversationStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';
import { CloseConversationHandler } from './close-conversation.handler';

describe('staff CloseConversationHandler', () => {
  it('atomically closes any non-closed conversation for an admin', async () => {
    const prisma: any = {
      chatConversation: {
        findUnique: jest.fn().mockResolvedValue({ id: 'conv-1', status: ConversationStatus.AI_ACTIVE, assignedStaffUserId: null }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const handler = new CloseConversationHandler(prisma as PrismaService);
    await handler.execute({ conversationId: 'conv-1', actorUserId: 'admin-a', actorRole: 'ADMIN' });
    expect(prisma.chatConversation.updateMany).toHaveBeenCalledWith({
      where: { id: 'conv-1', status: { not: ConversationStatus.CLOSED } },
      data: {
        status: ConversationStatus.CLOSED,
        closedAt: expect.any(Date),
        stateVersion: { increment: 1 },
        assistantLeaseOwner: null,
        assistantLeaseExpiresAt: null,
      },
    });
  });

  it('allows assigned staff only and rejects duplicate close deterministically', async () => {
    const prisma: any = {
      chatConversation: {
        findUnique: jest.fn().mockResolvedValue({ id: 'conv-1', status: ConversationStatus.STAFF_ACTIVE, assignedStaffUserId: 'staff-a' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const handler = new CloseConversationHandler(prisma as PrismaService);
    await handler.execute({ conversationId: 'conv-1', actorUserId: 'staff-a', actorRole: 'RECEPTIONIST' });
    expect(prisma.chatConversation.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'conv-1',
        status: { not: ConversationStatus.CLOSED },
        assignedStaffUserId: 'staff-a',
      },
      data: {
        status: ConversationStatus.CLOSED,
        closedAt: expect.any(Date),
        stateVersion: { increment: 1 },
        assistantLeaseOwner: null,
        assistantLeaseExpiresAt: null,
      },
    });
    await expect(handler.execute({ conversationId: 'conv-1', actorUserId: 'staff-b', actorRole: 'RECEPTIONIST' })).rejects.toThrow(ForbiddenException);
    prisma.chatConversation.findUnique.mockResolvedValue({ id: 'conv-1', status: ConversationStatus.CLOSED, assignedStaffUserId: 'staff-a' });
    await expect(handler.execute({ conversationId: 'conv-1', actorUserId: 'admin-a', actorRole: 'ADMIN' })).rejects.toThrow(ConflictException);
  });
});
