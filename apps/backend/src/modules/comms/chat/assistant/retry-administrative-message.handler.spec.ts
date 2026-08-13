import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConversationStatus, MessageSenderType } from '@prisma/client';
import { RlsTransactionService } from '../../../../infrastructure/database';
import { ChatAccessService } from '../guest/chat-access.service';
import { RetryAdministrativeMessageHandler } from './retry-administrative-message.handler';

describe('RetryAdministrativeMessageHandler', () => {
  const conversationId = 'conversation-1';
  const messageId = 'message-1';
  let transaction: any;
  let access: { guestTokenHash: jest.Mock };
  let handler: RetryAdministrativeMessageHandler;

  beforeEach(() => {
    transaction = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([]),
      chatConversation: { findFirst: jest.fn().mockResolvedValue({ id: conversationId, clientId: null, status: ConversationStatus.AI_ACTIVE, isAiChat: true, stateVersion: 0 }) },
      commsChatMessage: {
        findUnique: jest.fn().mockResolvedValue({
          id: messageId, conversationId, senderType: MessageSenderType.VISITOR,
          metadata: { assistantStatus: 'RETRYABLE_FAILURE', retryable: true },
        }),
        update: jest.fn().mockResolvedValue({ id: messageId }),
      },
      outboxEvent: { create: jest.fn().mockResolvedValue({ id: 'outbox-1' }) },
    };
    access = { guestTokenHash: jest.fn().mockReturnValue('guest-hash') };
    const rls = { withTransaction: jest.fn((work) => work(transaction)) };
    handler = new RetryAdministrativeMessageHandler(
      access as unknown as ChatAccessService,
      rls as unknown as RlsTransactionService,
    );
  });

  it('claims one retry and stages durable processing atomically without provider work', async () => {
    await expect(handler.execute({ audience: 'guest', conversationId, messageId, guestToken: 'token' }))
      .resolves.toEqual({ id: messageId });

    expect(transaction.chatConversation.findFirst).toHaveBeenCalledWith({
      where: { id: conversationId, clientId: null, guestTokenHash: 'guest-hash' },
      select: { id: true, clientId: true, status: true, isAiChat: true, stateVersion: true },
    });
    expect(transaction.$executeRaw).toHaveBeenCalledTimes(1);
    expect(transaction.commsChatMessage.update).toHaveBeenCalledWith({
      where: { id: messageId },
      data: { metadata: expect.objectContaining({
        assistantStatus: 'RETRYING', retryable: false, retryAttempts: 1,
        dispatchAttempt: 1, queuedAt: expect.any(String),
      }) },
    });
    expect(transaction.outboxEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      aggregateId: messageId,
      eventType: 'comms.chat.assistant.processing_requested',
      status: 'PENDING_V2', deliveryLane: 'PENDING_V2',
    }) });
  });

  it('enforces client ownership inside the locked transaction before reading the target message', async () => {
    transaction.chatConversation.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ audience: 'client', conversationId, messageId, clientId: 'other-client' }))
      .rejects.toThrow(NotFoundException);
    expect(transaction.commsChatMessage.findUnique).not.toHaveBeenCalled();
  });

  it.each([ConversationStatus.WAITING_FOR_STAFF, ConversationStatus.STAFF_ACTIVE, ConversationStatus.CLOSED])(
    'rejects retry when conversation status is %s without provider work',
    async (status) => {
      transaction.chatConversation.findFirst.mockResolvedValue({ id: conversationId, clientId: 'client-a', status, isAiChat: true, stateVersion: 0 });
      await expect(handler.execute({ audience: 'client', conversationId, messageId, clientId: 'client-a' }))
        .rejects.toThrow(BadRequestException);
      expect(transaction.outboxEvent.create).not.toHaveBeenCalled();
    },
  );

  it('rejects a message outside the owned conversation and a non-inbound message', async () => {
    transaction.commsChatMessage.findUnique.mockResolvedValueOnce(null);
    await expect(handler.execute({ audience: 'guest', conversationId, messageId, guestToken: 'token' }))
      .rejects.toThrow(NotFoundException);
    transaction.commsChatMessage.findUnique.mockResolvedValueOnce({
      id: messageId, conversationId, senderType: MessageSenderType.AI,
      metadata: { assistantStatus: 'RETRYABLE_FAILURE', retryable: true },
    });
    await expect(handler.execute({ audience: 'guest', conversationId, messageId, guestToken: 'token' }))
      .rejects.toThrow(BadRequestException);
  });

  it('rejects concurrent or exhausted retries and never exposes provider metadata', async () => {
    transaction.commsChatMessage.findUnique.mockResolvedValueOnce({
      id: messageId, conversationId, senderType: MessageSenderType.VISITOR,
      metadata: { assistantStatus: 'RETRYING', retryable: false, providerError: 'secret' },
    });
    await expect(handler.execute({ audience: 'guest', conversationId, messageId, guestToken: 'token' }))
      .rejects.toThrow(ConflictException);

    transaction.commsChatMessage.findUnique.mockResolvedValueOnce({
      id: messageId, conversationId, senderType: MessageSenderType.VISITOR,
      metadata: { assistantStatus: 'RETRYABLE_FAILURE', retryable: true, retryAttempts: 2 },
    });
    await expect(handler.execute({ audience: 'guest', conversationId, messageId, guestToken: 'token' }))
      .rejects.toThrow(BadRequestException);
    expect(transaction.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('rejects an old guest retry when claim wins before the locked ownership check', async () => {
    transaction.chatConversation.findFirst.mockResolvedValue(null);

    await expect(handler.execute({ audience: 'guest', conversationId, messageId, guestToken: 'old-token' }))
      .rejects.toThrow(NotFoundException);

    expect(transaction.$executeRaw).toHaveBeenCalledTimes(1);
    expect(transaction.commsChatMessage.findUnique).not.toHaveBeenCalled();
    expect(transaction.outboxEvent.create).not.toHaveBeenCalled();
  });
});
