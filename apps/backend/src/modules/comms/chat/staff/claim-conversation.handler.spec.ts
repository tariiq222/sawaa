import { ConflictException } from '@nestjs/common';
import { ConversationStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';
import { ClaimConversationHandler } from './claim-conversation.handler';

describe('ClaimConversationHandler', () => {
  it('allows exactly one winner across concurrent claims', async () => {
    let claimedBy: string | null = null;
    const prisma = {
      chatConversation: {
        updateMany: jest.fn().mockImplementation(({ data }) => {
          if (claimedBy) return Promise.resolve({ count: 0 });
          claimedBy = data.assignedStaffUserId;
          return Promise.resolve({ count: 1 });
        }),
        findUnique: jest.fn().mockImplementation(() => Promise.resolve({
          id: 'conv-1', status: ConversationStatus.STAFF_ACTIVE, assignedStaffUserId: claimedBy,
        })),
      },
    };
    const handler = new ClaimConversationHandler(prisma as unknown as PrismaService);

    const results = await Promise.allSettled([
      handler.execute({ conversationId: 'conv-1', staffUserId: 'staff-a' }),
      handler.execute({ conversationId: 'conv-1', staffUserId: 'staff-b' }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(rejected?.reason).toBeInstanceOf(ConflictException);
    expect(prisma.chatConversation.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'conv-1',
        status: ConversationStatus.WAITING_FOR_STAFF,
        assignedStaffUserId: null,
      },
      data: {
        status: ConversationStatus.STAFF_ACTIVE,
        assignedStaffUserId: 'staff-a',
        staffClaimedAt: expect.any(Date),
        stateVersion: { increment: 1 },
        assistantLeaseOwner: null,
        assistantLeaseExpiresAt: null,
      },
    });
  });
});
