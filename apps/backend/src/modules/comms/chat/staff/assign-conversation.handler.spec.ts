import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConversationStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';
import { AssignConversationHandler } from './assign-conversation.handler';

describe('AssignConversationHandler', () => {
  let prisma: any;
  let handler: AssignConversationHandler;

  beforeEach(() => {
    prisma = {
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'staff-b' }) },
      chatConversation: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'conv-1', status: ConversationStatus.STAFF_ACTIVE, assignedStaffUserId: 'staff-b' }),
      },
    };
    handler = new AssignConversationHandler(prisma as PrismaService);
  });

  it('lets an admin assign an active dashboard user with a conditional state transition', async () => {
    await handler.execute({ conversationId: 'conv-1', targetStaffUserId: 'staff-b', actorRole: 'ADMIN' });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'staff-b', isActive: true, role: { in: ['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST'] } },
      select: { id: true },
    });
    expect(prisma.chatConversation.updateMany).toHaveBeenCalledWith({
      where: { id: 'conv-1', status: { in: [ConversationStatus.WAITING_FOR_STAFF, ConversationStatus.STAFF_ACTIVE] } },
      data: {
        status: ConversationStatus.STAFF_ACTIVE,
        assignedStaffUserId: 'staff-b',
        staffClaimedAt: expect.any(Date),
        stateVersion: { increment: 1 },
        assistantLeaseOwner: null,
        assistantLeaseExpiresAt: null,
      },
    });
  });

  it.each(['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST'])('allows an active approved target role: %s', async (role) => {
    prisma.user.findFirst.mockResolvedValue({ id: 'staff-b', role });
    await expect(handler.execute({ conversationId: 'conv-1', targetStaffUserId: 'staff-b', actorRole: 'ADMIN' })).resolves.toBeDefined();
  });

  it.each(['OWNER', 'ACCOUNTANT', 'EMPLOYEE', 'CLIENT'])('rejects target role %s', async (role) => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ conversationId: 'conv-1', targetStaffUserId: role, actorRole: 'ADMIN' })).rejects.toThrow(NotFoundException);
  });

  it('rejects arbitrary assignment by receptionists', async () => {
    await expect(handler.execute({
      conversationId: 'conv-1', targetStaffUserId: 'staff-b', actorRole: 'RECEPTIONIST',
    })).rejects.toThrow(ForbiddenException);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('rejects inactive, missing, or client targets', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(handler.execute({
      conversationId: 'conv-1', targetStaffUserId: 'missing', actorRole: 'SUPER_ADMIN',
    })).rejects.toThrow(NotFoundException);
  });

  it('rejects a stale or closed conversation transition', async () => {
    prisma.chatConversation.updateMany.mockResolvedValue({ count: 0 });
    await expect(handler.execute({
      conversationId: 'conv-1', targetStaffUserId: 'staff-b', actorRole: 'ADMIN',
    })).rejects.toThrow(ConflictException);
  });
});
