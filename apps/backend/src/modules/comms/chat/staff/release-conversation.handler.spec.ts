import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ConversationStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';
import { ReleaseConversationHandler } from './release-conversation.handler';

describe('ReleaseConversationHandler', () => {
  it.each([
    { actorUserId: 'staff-a', actorRole: 'RECEPTIONIST' },
    { actorUserId: 'admin-a', actorRole: 'ADMIN' },
    { actorUserId: 'root-a', actorRole: 'SUPER_ADMIN' },
  ])('releases STAFF_ACTIVE to AI_ACTIVE for an assigned staff member or admin context: %j', async (actor) => {
    const prisma: any = {
      chatConversation: {
        findUnique: jest.fn().mockResolvedValue({ id: 'conv-1', isAiChat: true, status: ConversationStatus.STAFF_ACTIVE, assignedStaffUserId: 'staff-a' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const handler = new ReleaseConversationHandler(prisma as PrismaService);
    await handler.execute({ conversationId: 'conv-1', ...actor });
    expect(prisma.chatConversation.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'conv-1',
        status: ConversationStatus.STAFF_ACTIVE,
        isAiChat: true,
        ...(actor.actorRole === 'RECEPTIONIST' ? { assignedStaffUserId: 'staff-a' } : {}),
      },
      data: {
        status: ConversationStatus.AI_ACTIVE,
        assignedStaffUserId: null,
        staffClaimedAt: null,
        stateVersion: { increment: 1 },
        assistantLeaseOwner: null,
        assistantLeaseExpiresAt: null,
      },
    });
  });

  it('never releases a legacy non-AI conversation into AI_ACTIVE', async () => {
    const prisma: any = {
      chatConversation: {
        findUnique: jest.fn().mockResolvedValue({ id: 'conv-1', isAiChat: false, status: ConversationStatus.STAFF_ACTIVE, assignedStaffUserId: 'staff-a' }),
        updateMany: jest.fn(),
      },
    };
    const handler = new ReleaseConversationHandler(prisma as PrismaService);
    await expect(handler.execute({ conversationId: 'conv-1', actorUserId: 'admin-a', actorRole: 'ADMIN' })).rejects.toThrow(ConflictException);
    expect(prisma.chatConversation.updateMany).not.toHaveBeenCalled();
  });

  it('does not release after ownership changes between authorization and update', async () => {
    const prisma: any = {
      chatConversation: {
        findUnique: jest.fn().mockResolvedValue({ id: 'conv-1', isAiChat: true, status: ConversationStatus.STAFF_ACTIVE, assignedStaffUserId: 'staff-a' }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const handler = new ReleaseConversationHandler(prisma as PrismaService);
    await expect(handler.execute({ conversationId: 'conv-1', actorUserId: 'staff-a', actorRole: 'RECEPTIONIST' })).rejects.toThrow(ConflictException);
    expect(prisma.chatConversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ assignedStaffUserId: 'staff-a' }),
    }));
  });

  it('rejects an unassigned receptionist and a stale non-staff state', async () => {
    const prisma: any = {
      chatConversation: {
        findUnique: jest.fn().mockResolvedValue({ id: 'conv-1', isAiChat: true, status: ConversationStatus.STAFF_ACTIVE, assignedStaffUserId: 'staff-a' }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const handler = new ReleaseConversationHandler(prisma as PrismaService);
    await expect(handler.execute({ conversationId: 'conv-1', actorUserId: 'staff-b', actorRole: 'RECEPTIONIST' })).rejects.toThrow(ForbiddenException);
    prisma.chatConversation.findUnique.mockResolvedValue({ id: 'conv-1', status: ConversationStatus.WAITING_FOR_STAFF, assignedStaffUserId: null });
    await expect(handler.execute({ conversationId: 'conv-1', actorUserId: 'admin-a', actorRole: 'ADMIN' })).rejects.toThrow(ConflictException);
  });
});
