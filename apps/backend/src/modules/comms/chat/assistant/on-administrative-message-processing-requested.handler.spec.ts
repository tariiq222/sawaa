import { ConversationStatus, MessageSenderType } from '@prisma/client';
import { EventBusService } from '../../../../infrastructure/events';
import { PrismaService } from '../../../../infrastructure/database';
import { AdministrativeAssistantService } from './administrative-assistant.service';
import {
  ADMINISTRATIVE_MESSAGE_PROCESSING_CONSUMER_ID,
  OnAdministrativeMessageProcessingRequestedHandler,
} from './on-administrative-message-processing-requested.handler';

describe('OnAdministrativeMessageProcessingRequestedHandler', () => {
  const event = {
    eventId: 'event-1', source: 'comms', version: 1, occurredAt: new Date(),
    payload: { messageId: 'message-1', manualRetry: false, dispatchAttempt: 0 },
  };
  let eventBus: { subscribe: jest.Mock };
  let assistant: { processMessage: jest.Mock };
  let prisma: any;
  let handler: OnAdministrativeMessageProcessingRequestedHandler;

  beforeEach(() => {
    eventBus = { subscribe: jest.fn() };
    assistant = { processMessage: jest.fn().mockResolvedValue({ id: 'response-1' }) };
    prisma = {
      commsChatMessage: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'message-1', senderType: MessageSenderType.VISITOR,
          metadata: {
            assistantStatus: 'QUEUED', queuedAt: new Date().toISOString(),
            assistantStateVersion: 0, assistantClientId: null,
          },
          conversation: { status: ConversationStatus.AI_ACTIVE, isAiChat: true, stateVersion: 0, clientId: null },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    handler = new OnAdministrativeMessageProcessingRequestedHandler(
      eventBus as unknown as EventBusService,
      assistant as unknown as AdministrativeAssistantService,
      prisma as unknown as PrismaService,
    );
  });

  it('registers one stable durable consumer and processes the exact inbound message', async () => {
    handler.register();
    expect(eventBus.subscribe).toHaveBeenCalledWith(
      'comms.chat.assistant.processing_requested',
      ADMINISTRATIVE_MESSAGE_PROCESSING_CONSUMER_ID,
      expect.any(Function),
    );
    await expect(eventBus.subscribe.mock.calls[0][2](event)).resolves.toBeUndefined();
    expect(assistant.processMessage).toHaveBeenCalledWith('message-1', { manualRetry: false });
  });

  it('throws while an active queued message is still unanswered so BullMQ retries a lease loser', async () => {
    assistant.processMessage.mockResolvedValue(null);
    await expect(handler.handle(event)).rejects.toThrow('processing remains pending');
  });

  it('acknowledges a provider failure only after the message is safely retryable', async () => {
    assistant.processMessage.mockResolvedValue(null);
    prisma.commsChatMessage.findUnique.mockResolvedValue({
      id: 'message-1', senderType: MessageSenderType.VISITOR,
      metadata: { assistantStatus: 'RETRYABLE_FAILURE', retryable: true },
      conversation: { status: ConversationStatus.AI_ACTIVE, isAiChat: true, stateVersion: 0, clientId: null },
    });
    await expect(handler.handle(event)).resolves.toBeUndefined();
  });

  it('clears RETRYING when handoff or close wins so the message never remains deadlocked', async () => {
    assistant.processMessage.mockResolvedValue(null);
    prisma.commsChatMessage.findUnique.mockResolvedValue({
      id: 'message-1', senderType: MessageSenderType.VISITOR,
      metadata: { assistantStatus: 'RETRYING', retryable: false, providerError: 'must-not-leak' },
      conversation: { status: ConversationStatus.WAITING_FOR_STAFF, isAiChat: true, stateVersion: 1, clientId: null },
    });

    await expect(handler.handle({ ...event, payload: { ...event.payload, manualRetry: true } })).resolves.toBeUndefined();
    expect(prisma.commsChatMessage.updateMany).toHaveBeenCalledWith({
      where: { id: 'message-1' },
      data: { metadata: expect.anything() },
    });
    expect(JSON.stringify(prisma.commsChatMessage.updateMany.mock.calls)).not.toContain('providerError');
  });

  it('supersedes a queued guest epoch after claim instead of retrying it under the new client identity', async () => {
    assistant.processMessage.mockResolvedValue(null);
    prisma.commsChatMessage.findUnique.mockResolvedValue({
      id: 'message-1', senderType: MessageSenderType.VISITOR,
      metadata: { assistantStatus: 'QUEUED', assistantStateVersion: 0, assistantClientId: null },
      conversation: { status: ConversationStatus.AI_ACTIVE, isAiChat: true, stateVersion: 1, clientId: 'client-a' },
    });

    await expect(handler.handle(event)).resolves.toBeUndefined();
    expect(prisma.commsChatMessage.updateMany).toHaveBeenCalled();
  });
});
