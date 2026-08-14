import { ConflictException } from '@nestjs/common';
import { ConversationStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';
import { ChatAccessService } from '../guest/chat-access.service';
import { RequestHandoffHandler } from './request-handoff.handler';

const conversation = {
  id: '00000000-0000-4000-a000-000000000001',
  clientId: null,
  guestTokenHash: 'guest-hash',
  status: ConversationStatus.AI_ACTIVE,
  guestName: null,
  guestPhone: null,
};

describe('RequestHandoffHandler', () => {
  let prisma: { chatConversation: { updateMany: jest.Mock; findFirst: jest.Mock; findUnique: jest.Mock } };
  let access: { assertGuestAccess: jest.Mock; assertClientAccess: jest.Mock };
  let handler: RequestHandoffHandler;
  let audit: { record: jest.Mock };

  beforeEach(() => {
    prisma = {
      chatConversation: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue({
          ...conversation,
          status: ConversationStatus.WAITING_FOR_STAFF,
          guestName: 'سارة',
          guestPhone: '+966501234567',
        }),
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
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    handler = new RequestHandoffHandler(
      prisma as unknown as PrismaService,
      access as unknown as ChatAccessService,
      audit as never,
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
      where: {
        id: conversation.id,
        status: ConversationStatus.AI_ACTIVE,
        clientId: null,
        guestTokenHash: 'guest-hash',
      },
      data: {
        status: ConversationStatus.WAITING_FOR_STAFF,
        handoffRequestedAt: expect.any(Date),
        guestName: 'سارة',
        guestPhone: '+966501234567',
        stateVersion: { increment: 1 },
        assistantLeaseOwner: null,
        assistantLeaseExpiresAt: null,
      },
    });
    expect(JSON.stringify(prisma.chatConversation.updateMany.mock.calls)).not.toMatch(/reason|risk|tag/i);
    expect(audit.record).toHaveBeenCalledWith({
      action: 'HANDOFF_REQUESTED', conversationId: conversation.id,
    });
  });

  it('derives authenticated client identity and never writes guest contact fields', async () => {
    await handler.execute({ audience: 'client', conversationId: conversation.id, clientId: 'client-a' });

    expect(access.assertClientAccess).toHaveBeenCalledWith(conversation.id, 'client-a');
    expect(prisma.chatConversation.updateMany).toHaveBeenCalledWith({
      where: { id: conversation.id, status: ConversationStatus.AI_ACTIVE, clientId: 'client-a' },
      data: {
        status: ConversationStatus.WAITING_FOR_STAFF,
        handoffRequestedAt: expect.any(Date),
        stateVersion: { increment: 1 },
        assistantLeaseOwner: null,
        assistantLeaseExpiresAt: null,
      },
    });
  });

  it('does not let a stale guest write contact after the conversation is claimed', async () => {
    prisma.chatConversation.updateMany.mockResolvedValue({ count: 0 });
    prisma.chatConversation.findFirst.mockResolvedValue(null);
    prisma.chatConversation.findUnique.mockResolvedValue({
      ...conversation, clientId: 'client-a', status: ConversationStatus.WAITING_FOR_STAFF,
    });

    await expect(handler.execute({
      audience: 'guest', conversationId: conversation.id, guestToken: 'guest-token', guestName: 'attacker', guestPhone: '+966501234567',
    })).rejects.toThrow(ConflictException);
    expect(prisma.chatConversation.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: conversation.id, clientId: null, guestTokenHash: 'guest-hash' }),
    });
  });

  it('does not return guest data when claiming wins immediately after the handoff CAS', async () => {
    prisma.chatConversation.updateMany.mockResolvedValue({ count: 1 });
    prisma.chatConversation.findFirst.mockResolvedValue(null);
    prisma.chatConversation.findUnique.mockResolvedValue({
      ...conversation,
      clientId: 'client-a',
      guestTokenHash: null,
      guestName: null,
      guestPhone: null,
      status: ConversationStatus.WAITING_FOR_STAFF,
    });

    await expect(handler.execute({
      audience: 'guest', conversationId: conversation.id, guestToken: 'guest-token', guestName: 'سارة', guestPhone: '+966501234567',
    })).rejects.toThrow(ConflictException);
  });

  it('returns the winning waiting state idempotently after a duplicate race', async () => {
    prisma.chatConversation.updateMany.mockResolvedValue({ count: 0 });

    await expect(handler.execute({
      audience: 'guest', conversationId: conversation.id, guestToken: 'guest-token', guestName: 'سارة', guestPhone: '+966501234567',
    })).resolves.toEqual(expect.objectContaining({ status: ConversationStatus.WAITING_FOR_STAFF }));
    expect(audit.record).not.toHaveBeenCalled();
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
