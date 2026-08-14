import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConversationStatus, MessageSenderType, Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { ChatAccessService } from '../guest/chat-access.service';
import { SendChatMessageHandler } from './send-chat-message.handler';

const guestConversation = {
  id: '00000000-0000-4000-a000-000000000001',
  clientId: null,
  isAiChat: true,
  status: ConversationStatus.AI_ACTIVE,
  stateVersion: 0,
};

function knownRequestError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('duplicate', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

describe('SendChatMessageHandler', () => {
  let prisma: {
    commsChatMessage: { findUnique: jest.Mock };
    chatConversation: { findFirst: jest.Mock };
  };
  let transaction: {
    $executeRaw: jest.Mock;
    $queryRaw: jest.Mock;
    commsChatMessage: { findUnique: jest.Mock; create: jest.Mock };
    chatConversation: { findFirst: jest.Mock; updateMany: jest.Mock };
    outboxEvent: { create: jest.Mock };
  };
  let rlsTransaction: { withTransaction: jest.Mock };
  let access: { assertGuestAccess: jest.Mock; assertClientAccess: jest.Mock; guestTokenHash: jest.Mock };
  let limits: { consumeMessage: jest.Mock };
  let handler: SendChatMessageHandler;

  beforeEach(() => {
    transaction = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([]),
      commsChatMessage: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'message-1' }),
      },
      chatConversation: {
        findFirst: jest.fn().mockResolvedValue(guestConversation),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      outboxEvent: { create: jest.fn().mockResolvedValue({ id: 'outbox-1' }) },
    };
    prisma = {
      commsChatMessage: { findUnique: jest.fn() },
      chatConversation: { findFirst: jest.fn().mockResolvedValue({ ...guestConversation, status: ConversationStatus.STAFF_ACTIVE, assignedStaffUserId: 'staff-a' }) },
    };
    rlsTransaction = { withTransaction: jest.fn().mockImplementation((work) => work(transaction)) };
    access = {
      assertGuestAccess: jest.fn().mockResolvedValue(guestConversation),
      assertClientAccess: jest.fn().mockResolvedValue({ ...guestConversation, clientId: 'client-a' }),
      guestTokenHash: jest.fn().mockReturnValue('guest-hash'),
    };
    limits = { consumeMessage: jest.fn().mockResolvedValue(undefined) };
    handler = new SendChatMessageHandler(
      prisma as unknown as PrismaService,
      access as unknown as ChatAccessService,
      { getOrThrow: jest.fn().mockReturnValue(10) } as unknown as ConfigService,
      rlsTransaction as unknown as RlsTransactionService,
      limits as never,
    );
  });

  it('rejects blank and oversized bodies before any access or persistence occurs', async () => {
    await expect(handler.execute({
      audience: 'guest', conversationId: guestConversation.id, guestToken: 'guest-token', body: '   ', clientMessageId: 'm-1',
    })).rejects.toThrow(BadRequestException);
    await expect(handler.execute({
      audience: 'guest', conversationId: guestConversation.id, guestToken: 'guest-token', body: '01234567890', clientMessageId: 'm-2',
    })).rejects.toThrow(BadRequestException);

    expect(access.assertGuestAccess).not.toHaveBeenCalled();
    expect(rlsTransaction.withTransaction).not.toHaveBeenCalled();
  });

  it('accepts 4000 characters and rejects 4001 when CHAT_MAX_MESSAGE_LENGTH is 4000', async () => {
    handler = new SendChatMessageHandler(
      prisma as unknown as PrismaService,
      access as unknown as ChatAccessService,
      { getOrThrow: jest.fn().mockReturnValue(4000) } as unknown as ConfigService,
      rlsTransaction as unknown as RlsTransactionService,
      limits as never,
    );

    await expect(handler.execute({
      audience: 'guest', conversationId: guestConversation.id, guestToken: 'guest-token', body: 'a'.repeat(4000), clientMessageId: 'max-length',
    })).resolves.toEqual({ id: 'message-1' });
    await expect(handler.execute({
      audience: 'guest', conversationId: guestConversation.id, guestToken: 'guest-token', body: 'a'.repeat(4001), clientMessageId: 'too-long',
    })).rejects.toThrow(BadRequestException);
  });

  it('rate-limits guest messages by opaque guest hash and request IP before persistence', async () => {
    await handler.execute({
      audience: 'guest', conversationId: guestConversation.id, guestToken: 'raw-token',
      ipAddress: '203.0.113.42', body: 'hello', clientMessageId: 'rate-1',
    });

    expect(limits.consumeMessage).toHaveBeenCalledWith({
      identity: 'guest:guest-hash',
      ipAddress: '203.0.113.42',
    });
    expect(limits.consumeMessage.mock.invocationCallOrder[0])
      .toBeLessThan(transaction.commsChatMessage.create.mock.invocationCallOrder[0]);
  });

  it('derives a VISITOR sender from guest access and updates message time and staff unread count in one transaction', async () => {
    const result = await handler.execute({
      audience: 'guest', conversationId: guestConversation.id, guestToken: 'guest-token', body: '  مرحبا  ', clientMessageId: 'm-1',
    });

    expect(result).toEqual({ id: 'message-1' });
    expect(transaction.chatConversation.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: guestConversation.id,
        clientId: null,
        guestTokenHash: expect.any(String),
      }),
    });
    expect(rlsTransaction.withTransaction).toHaveBeenCalledTimes(1);
    expect(transaction.$executeRaw).toHaveBeenCalledTimes(1);
    expect(transaction.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      transaction.commsChatMessage.create.mock.invocationCallOrder[0],
    );
    expect(transaction.commsChatMessage.create).toHaveBeenCalledWith({
      data: {
        conversationId: guestConversation.id,
        senderType: MessageSenderType.VISITOR,
        senderId: null,
        body: 'مرحبا',
        clientMessageId: 'm-1',
        metadata: expect.objectContaining({
          assistantStatus: 'QUEUED',
          dispatchAttempt: 0,
          queuedAt: expect.any(String),
        }),
      },
    });
    expect(transaction.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        aggregateId: 'message-1',
        eventType: 'comms.chat.assistant.processing_requested',
        status: 'PENDING_V2',
        deliveryLane: 'PENDING_V2',
      }),
    });
    expect(transaction.chatConversation.updateMany).toHaveBeenCalledWith({
      where: {
        id: guestConversation.id,
        status: { not: ConversationStatus.CLOSED },
        clientId: null,
        guestTokenHash: 'guest-hash',
      },
      data: {
        lastMessageAt: expect.any(Date),
        staffUnreadCount: { increment: 1 },
      },
    });
  });

  it('derives a CLIENT sender and authenticated senderId from the client access context', async () => {
    transaction.chatConversation.findFirst.mockResolvedValue({ ...guestConversation, clientId: 'client-a' });
    await handler.execute({
      audience: 'client', conversationId: guestConversation.id, clientId: 'client-a', body: 'hello', clientMessageId: 'm-2',
    });

    expect(transaction.chatConversation.findFirst).toHaveBeenCalledWith({
      where: { id: guestConversation.id, clientId: 'client-a' },
    });
    expect(transaction.commsChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ senderType: MessageSenderType.CLIENT, senderId: 'client-a' }),
    }));
  });

  it('persists an assigned staff reply through the unified idempotent path and increments client unread', async () => {
    await handler.execute({
      audience: 'staff', conversationId: guestConversation.id, staffUserId: 'staff-a', body: ' hello ', clientMessageId: 'staff-1',
    });

    expect(prisma.chatConversation.findFirst).toHaveBeenCalledWith({
      where: {
        id: guestConversation.id,
        status: ConversationStatus.STAFF_ACTIVE,
        assignedStaffUserId: 'staff-a',
      },
    });
    expect(transaction.commsChatMessage.create).toHaveBeenCalledWith({
      data: {
        conversationId: guestConversation.id,
        senderType: MessageSenderType.STAFF,
        senderId: 'staff-a',
        body: 'hello',
        clientMessageId: 'staff-1',
      },
    });
    expect(transaction.chatConversation.updateMany).toHaveBeenCalledWith({
      where: {
        id: guestConversation.id,
        status: ConversationStatus.STAFF_ACTIVE,
        assignedStaffUserId: 'staff-a',
      },
      data: { lastMessageAt: expect.any(Date), clientUnreadCount: { increment: 1 } },
    });
  });

  it('returns a staff duplicate only to its original sender', async () => {
    prisma.commsChatMessage.findUnique.mockResolvedValue({
      id: 'original', senderType: MessageSenderType.STAFF, senderId: 'staff-a', clientMessageId: 'staff-1',
    });
    await expect(handler.execute({
      audience: 'staff', conversationId: guestConversation.id, staffUserId: 'staff-a', body: 'retry', clientMessageId: 'staff-1',
    })).resolves.toEqual(expect.objectContaining({ id: 'original' }));
    await expect(handler.execute({
      audience: 'staff', conversationId: guestConversation.id, staffUserId: 'staff-b', body: 'steal', clientMessageId: 'staff-1',
    })).rejects.toThrow('Idempotency key belongs to another sender');
  });

  it('returns the original staff message after release or reassignment only to the original sender', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue(null);
    prisma.commsChatMessage.findUnique.mockResolvedValue({
      id: 'original', senderType: MessageSenderType.STAFF, senderId: 'staff-a', clientMessageId: 'staff-1',
    });
    await expect(handler.execute({
      audience: 'staff', conversationId: guestConversation.id, staffUserId: 'staff-a', body: 'retry', clientMessageId: 'staff-1',
    })).resolves.toEqual(expect.objectContaining({ id: 'original' }));
  });

  it('checks a staff idempotency key before current state or retry-body validation', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue(null);
    prisma.commsChatMessage.findUnique.mockResolvedValue({
      id: 'original', senderType: MessageSenderType.STAFF, senderId: 'staff-a', clientMessageId: 'staff-1',
    });
    await expect(handler.execute({
      audience: 'staff', conversationId: guestConversation.id, staffUserId: 'staff-a', body: ' ', clientMessageId: 'staff-1',
    })).resolves.toEqual(expect.objectContaining({ id: 'original' }));
    expect(prisma.chatConversation.findFirst).not.toHaveBeenCalled();
  });

  it('does not allow a known conversation ID to bypass guest ownership', async () => {
    transaction.chatConversation.findFirst.mockResolvedValue(null);

    await expect(handler.execute({
      audience: 'guest', conversationId: guestConversation.id, guestToken: 'other-guest-token', body: 'hello', clientMessageId: 'm-3',
    })).rejects.toThrow(NotFoundException);
    expect(transaction.commsChatMessage.create).not.toHaveBeenCalled();
  });

  it('revalidates guest ownership after the conversation lock so claim cannot race an insert', async () => {
    transaction.chatConversation.findFirst.mockResolvedValue(null);

    await expect(handler.execute({
      audience: 'guest', conversationId: guestConversation.id, guestToken: 'guest-token', body: 'hello', clientMessageId: 'claim-race',
    })).rejects.toThrow(NotFoundException);

    expect(transaction.$executeRaw).toHaveBeenCalledTimes(1);
    expect(transaction.chatConversation.findFirst.mock.invocationCallOrder[0]).toBeGreaterThan(
      transaction.$executeRaw.mock.invocationCallOrder[0],
    );
    expect(transaction.commsChatMessage.create).not.toHaveBeenCalled();
    expect(transaction.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('blocks sending to a closed conversation while preserving owner read access for the list handler', async () => {
    transaction.chatConversation.findFirst.mockResolvedValue({ ...guestConversation, status: ConversationStatus.CLOSED });

    await expect(handler.execute({
      audience: 'guest', conversationId: guestConversation.id, guestToken: 'guest-token', body: 'hello', clientMessageId: 'm-4',
    })).rejects.toThrow(BadRequestException);
    expect(transaction.commsChatMessage.create).not.toHaveBeenCalled();
  });

  it('returns the original message on an ordinary duplicate without incrementing counters', async () => {
    transaction.commsChatMessage.findUnique.mockResolvedValue({ id: 'original-message', body: 'hello' });

    await expect(handler.execute({
      audience: 'guest', conversationId: guestConversation.id, guestToken: 'guest-token', body: 'hello', clientMessageId: 'same-id',
    })).resolves.toEqual({ id: 'original-message', body: 'hello' });

    expect(rlsTransaction.withTransaction).toHaveBeenCalledTimes(1);
    expect(transaction.chatConversation.updateMany).not.toHaveBeenCalled();
    expect(transaction.commsChatMessage.findUnique).toHaveBeenCalledWith({
      where: { conversationId_clientMessageId: { conversationId: guestConversation.id, clientMessageId: 'same-id' } },
    });
  });

  it('reads back the winning message after a concurrent unique-index race instead of retrying AI-triggering work', async () => {
    transaction.commsChatMessage.create.mockRejectedValue(knownRequestError());
    transaction.commsChatMessage.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'race-winner', clientMessageId: 'race-id' });

    await expect(handler.execute({
      audience: 'client', conversationId: guestConversation.id, clientId: 'client-a', body: 'hello', clientMessageId: 'race-id',
    })).resolves.toEqual({ id: 'race-winner', clientMessageId: 'race-id' });

    expect(rlsTransaction.withTransaction).toHaveBeenCalledTimes(2);
    expect(transaction.chatConversation.updateMany).not.toHaveBeenCalled();
  });

  it('applies staff sender identity checks to the P2002 winning-message readback', async () => {
    transaction.commsChatMessage.create.mockRejectedValue(knownRequestError());
    prisma.commsChatMessage.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'other-staff-message',
        senderType: MessageSenderType.STAFF,
        senderId: 'staff-b',
        clientMessageId: 'staff-race',
      });

    await expect(handler.execute({
      audience: 'staff', conversationId: guestConversation.id, staffUserId: 'staff-a', body: 'hello', clientMessageId: 'staff-race',
    })).rejects.toThrow('Idempotency key belongs to another sender');
  });
});
