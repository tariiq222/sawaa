import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConversationStatus, MessageSenderType, Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { ChatAccessService } from '../guest/chat-access.service';
import { SendChatMessageHandler } from './send-chat-message.handler';

const guestConversation = {
  id: '00000000-0000-4000-a000-000000000001',
  clientId: null,
  status: ConversationStatus.AI_ACTIVE,
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
  };
  let transaction: {
    commsChatMessage: { create: jest.Mock };
    chatConversation: { updateMany: jest.Mock };
  };
  let rlsTransaction: { withTransaction: jest.Mock };
  let access: { assertGuestAccess: jest.Mock; assertClientAccess: jest.Mock };
  let handler: SendChatMessageHandler;

  beforeEach(() => {
    transaction = {
      commsChatMessage: { create: jest.fn().mockResolvedValue({ id: 'message-1' }) },
      chatConversation: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    prisma = {
      commsChatMessage: { findUnique: jest.fn() },
    };
    rlsTransaction = { withTransaction: jest.fn().mockImplementation((work) => work(transaction)) };
    access = {
      assertGuestAccess: jest.fn().mockResolvedValue(guestConversation),
      assertClientAccess: jest.fn().mockResolvedValue({ ...guestConversation, clientId: 'client-a' }),
    };
    handler = new SendChatMessageHandler(
      prisma as unknown as PrismaService,
      access as unknown as ChatAccessService,
      { getOrThrow: jest.fn().mockReturnValue(10) } as unknown as ConfigService,
      rlsTransaction as unknown as RlsTransactionService,
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

  it('derives a VISITOR sender from guest access and updates message time and staff unread count in one transaction', async () => {
    const result = await handler.execute({
      audience: 'guest', conversationId: guestConversation.id, guestToken: 'guest-token', body: '  مرحبا  ', clientMessageId: 'm-1',
    });

    expect(result).toEqual({ id: 'message-1' });
    expect(access.assertGuestAccess).toHaveBeenCalledWith(guestConversation.id, 'guest-token');
    expect(rlsTransaction.withTransaction).toHaveBeenCalledTimes(1);
    expect(transaction.commsChatMessage.create).toHaveBeenCalledWith({
      data: {
        conversationId: guestConversation.id,
        senderType: MessageSenderType.VISITOR,
        senderId: null,
        body: 'مرحبا',
        clientMessageId: 'm-1',
      },
    });
    expect(transaction.chatConversation.updateMany).toHaveBeenCalledWith({
      where: { id: guestConversation.id, status: { not: ConversationStatus.CLOSED } },
      data: {
        lastMessageAt: expect.any(Date),
        staffUnreadCount: { increment: 1 },
      },
    });
  });

  it('derives a CLIENT sender and authenticated senderId from the client access context', async () => {
    await handler.execute({
      audience: 'client', conversationId: guestConversation.id, clientId: 'client-a', body: 'hello', clientMessageId: 'm-2',
    });

    expect(access.assertClientAccess).toHaveBeenCalledWith(guestConversation.id, 'client-a');
    expect(transaction.commsChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ senderType: MessageSenderType.CLIENT, senderId: 'client-a' }),
    }));
  });

  it('does not allow a known conversation ID to bypass guest ownership', async () => {
    access.assertGuestAccess.mockRejectedValue(new NotFoundException('Conversation not found'));

    await expect(handler.execute({
      audience: 'guest', conversationId: guestConversation.id, guestToken: 'other-guest-token', body: 'hello', clientMessageId: 'm-3',
    })).rejects.toThrow(NotFoundException);
    expect(rlsTransaction.withTransaction).not.toHaveBeenCalled();
  });

  it('blocks sending to a closed conversation while preserving owner read access for the list handler', async () => {
    access.assertGuestAccess.mockResolvedValue({ ...guestConversation, status: ConversationStatus.CLOSED });

    await expect(handler.execute({
      audience: 'guest', conversationId: guestConversation.id, guestToken: 'guest-token', body: 'hello', clientMessageId: 'm-4',
    })).rejects.toThrow(BadRequestException);
    expect(rlsTransaction.withTransaction).not.toHaveBeenCalled();
  });

  it('returns the original message on an ordinary duplicate without incrementing counters', async () => {
    prisma.commsChatMessage.findUnique.mockResolvedValue({ id: 'original-message', body: 'hello' });

    await expect(handler.execute({
      audience: 'guest', conversationId: guestConversation.id, guestToken: 'guest-token', body: 'hello', clientMessageId: 'same-id',
    })).resolves.toEqual({ id: 'original-message', body: 'hello' });

    expect(rlsTransaction.withTransaction).not.toHaveBeenCalled();
    expect(transaction.chatConversation.updateMany).not.toHaveBeenCalled();
    expect(prisma.commsChatMessage.findUnique).toHaveBeenCalledWith({
      where: { conversationId_clientMessageId: { conversationId: guestConversation.id, clientMessageId: 'same-id' } },
    });
  });

  it('reads back the winning message after a concurrent unique-index race instead of retrying AI-triggering work', async () => {
    transaction.commsChatMessage.create.mockRejectedValue(knownRequestError());
    prisma.commsChatMessage.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'race-winner', clientMessageId: 'race-id' });

    await expect(handler.execute({
      audience: 'client', conversationId: guestConversation.id, clientId: 'client-a', body: 'hello', clientMessageId: 'race-id',
    })).resolves.toEqual({ id: 'race-winner', clientMessageId: 'race-id' });

    expect(rlsTransaction.withTransaction).toHaveBeenCalledTimes(1);
    expect(transaction.chatConversation.updateMany).not.toHaveBeenCalled();
  });
});
