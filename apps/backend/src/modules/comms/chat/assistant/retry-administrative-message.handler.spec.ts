import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConversationStatus, MessageSenderType } from '@prisma/client';
import { RlsTransactionService } from '../../../../infrastructure/database';
import { ChatAccessService } from '../guest/chat-access.service';
import { AdministrativeAssistantService } from './administrative-assistant.service';
import { RetryAdministrativeMessageHandler } from './retry-administrative-message.handler';

describe('RetryAdministrativeMessageHandler', () => {
  const conversationId = 'conversation-1';
  const messageId = 'message-1';
  let transaction: any;
  let access: { assertGuestAccess: jest.Mock; assertClientAccess: jest.Mock };
  let assistant: { processMessage: jest.Mock };
  let handler: RetryAdministrativeMessageHandler;

  beforeEach(() => {
    transaction = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      chatConversation: { findUnique: jest.fn().mockResolvedValue({ id: conversationId, status: ConversationStatus.AI_ACTIVE, isAiChat: true }) },
      commsChatMessage: {
        findUnique: jest.fn().mockResolvedValue({
          id: messageId, conversationId, senderType: MessageSenderType.VISITOR,
          metadata: { assistantStatus: 'RETRYABLE_FAILURE', retryable: true },
        }),
        update: jest.fn().mockResolvedValue({ id: messageId }),
      },
    };
    access = {
      assertGuestAccess: jest.fn().mockResolvedValue({ id: conversationId }),
      assertClientAccess: jest.fn().mockResolvedValue({ id: conversationId }),
    };
    assistant = { processMessage: jest.fn().mockResolvedValue({ id: 'response-1', senderType: MessageSenderType.AI }) };
    const rls = { withTransaction: jest.fn((work) => work(transaction)) };
    handler = new RetryAdministrativeMessageHandler(
      access as unknown as ChatAccessService,
      rls as unknown as RlsTransactionService,
      assistant as unknown as AdministrativeAssistantService,
    );
  });

  it('claims one retry atomically, then performs provider work after the transaction', async () => {
    const order: string[] = [];
    transaction.commsChatMessage.update.mockImplementation(async () => { order.push('commit'); return { id: messageId }; });
    assistant.processMessage.mockImplementation(async () => { order.push('assistant'); return { id: 'response-1' }; });

    await expect(handler.execute({ audience: 'guest', conversationId, messageId, guestToken: 'token' }))
      .resolves.toEqual({ id: 'response-1' });

    expect(access.assertGuestAccess).toHaveBeenCalledWith(conversationId, 'token');
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
    expect(transaction.commsChatMessage.update).toHaveBeenCalledWith({
      where: { id: messageId },
      data: { metadata: { assistantStatus: 'RETRYING', retryable: false, retryAttempts: 1 } },
    });
    expect(assistant.processMessage).toHaveBeenCalledWith(messageId, { manualRetry: true });
    expect(order).toEqual(['commit', 'assistant']);
  });

  it('enforces client ownership before reading the target message', async () => {
    access.assertClientAccess.mockRejectedValue(new NotFoundException());
    await expect(handler.execute({ audience: 'client', conversationId, messageId, clientId: 'other-client' }))
      .rejects.toThrow(NotFoundException);
    expect(transaction.commsChatMessage.findUnique).not.toHaveBeenCalled();
  });

  it.each([ConversationStatus.WAITING_FOR_STAFF, ConversationStatus.STAFF_ACTIVE, ConversationStatus.CLOSED])(
    'rejects retry when conversation status is %s without provider work',
    async (status) => {
      transaction.chatConversation.findUnique.mockResolvedValue({ id: conversationId, status, isAiChat: true });
      await expect(handler.execute({ audience: 'client', conversationId, messageId, clientId: 'client-a' }))
        .rejects.toThrow(BadRequestException);
      expect(assistant.processMessage).not.toHaveBeenCalled();
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
    expect(assistant.processMessage).not.toHaveBeenCalled();
  });
});
