import { ConflictException } from '@nestjs/common';
import { ConversationStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';
import { ChatAccessService } from '../guest/chat-access.service';
import { RequestHandoffHandler } from './request-handoff.handler';

const conversation = {
  id: '00000000-0000-4000-a000-000000000001',
  clientId: null,
  status: ConversationStatus.AI_ACTIVE,
  guestName: null,
  guestPhone: null,
};

describe('RequestHandoffHandler', () => {
  let prisma: { chatConversation: { updateMany: jest.Mock; findUnique: jest.Mock } };
  let access: { assertGuestAccess: jest.Mock; assertClientAccess: jest.Mock };
  let handler: RequestHandoffHandler;

  beforeEach(() => {
    prisma = {
      chatConversation: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({
          ...conversation,
          status: ConversationStatus.WAITING_FOR_STAFF,
          guestName: 'سارة',
          guestPhone: '+966501234567',
        }),
      },
    };
    access = {
      assertGuestAccess: jest.fn().mockResolvedValue(conversation),
      assertClientAccess: jest.fn().mockResolvedValue({ ...conversation, clientId: 'client-a' }),
    };
    handler = new RequestHandoffHandler(
      prisma as unknown as PrismaService,
      access as unknown as ChatAccessService,
    );
  });

  it('atomically moves an owned guest AI conversation to waiting and stores only trimmed contact fields', async () => {
    await handler.execute({
      audience: 'guest',
      conversationId: conversation.id,
      guestToken: 'guest-token',
      guestName: '  سارة  ',
      guestPhone: '+966501234567',
    });

    expect(access.assertGuestAccess).toHaveBeenCalledWith(conversation.id, 'guest-token');
    expect(prisma.chatConversation.updateMany).toHaveBeenCalledWith({
      where: { id: conversation.id, status: ConversationStatus.AI_ACTIVE },
      data: {
        status: ConversationStatus.WAITING_FOR_STAFF,
        handoffRequestedAt: expect.any(Date),
        guestName: 'سارة',
        guestPhone: '+966501234567',
      },
    });
    expect(JSON.stringify(prisma.chatConversation.updateMany.mock.calls)).not.toMatch(/reason|risk|tag/i);
  });

  it('derives authenticated client identity and never writes guest contact fields', async () => {
    await handler.execute({ audience: 'client', conversationId: conversation.id, clientId: 'client-a' });

    expect(access.assertClientAccess).toHaveBeenCalledWith(conversation.id, 'client-a');
    expect(prisma.chatConversation.updateMany).toHaveBeenCalledWith({
      where: { id: conversation.id, status: ConversationStatus.AI_ACTIVE },
      data: {
        status: ConversationStatus.WAITING_FOR_STAFF,
        handoffRequestedAt: expect.any(Date),
      },
    });
  });

  it('returns the winning waiting state idempotently after a duplicate race', async () => {
    prisma.chatConversation.updateMany.mockResolvedValue({ count: 0 });

    await expect(handler.execute({
      audience: 'guest', conversationId: conversation.id, guestToken: 'guest-token', guestName: 'سارة', guestPhone: '+966501234567',
    })).resolves.toEqual(expect.objectContaining({ status: ConversationStatus.WAITING_FOR_STAFF }));
  });

  it.each([
    ConversationStatus.STAFF_ACTIVE,
    ConversationStatus.CLOSED,
    ConversationStatus.OPEN,
  ])('rejects handoff from %s without writing', async (status) => {
    access.assertGuestAccess.mockResolvedValue({ ...conversation, status });

    await expect(handler.execute({
      audience: 'guest', conversationId: conversation.id, guestToken: 'guest-token', guestName: 'سارة', guestPhone: '+966501234567',
    })).rejects.toThrow(ConflictException);
    expect(prisma.chatConversation.updateMany).not.toHaveBeenCalled();
  });
});
