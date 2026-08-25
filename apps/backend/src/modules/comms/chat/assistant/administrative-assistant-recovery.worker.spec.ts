import { ConversationStatus, MessageSenderType } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { BullMqService } from '../../../../infrastructure/queue/bull-mq.service';
import { AdministrativeAssistantRecoveryWorker } from './administrative-assistant-recovery.worker';

describe('AdministrativeAssistantRecoveryWorker', () => {
  let prisma: any;
  let tx: any;
  let bullMq: any;
  let worker: AdministrativeAssistantRecoveryWorker;

  beforeEach(() => {
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      commsChatMessage: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({
            id: 'message-1', conversationId: 'conversation-1', senderType: MessageSenderType.VISITOR,
            metadata: {
              assistantStatus: 'QUEUED', dispatchAttempt: 0, queuedAt: '2026-08-13T08:00:00.000Z',
              assistantStateVersion: 0, assistantClientId: null,
            },
          })
          .mockResolvedValueOnce(null),
        update: jest.fn().mockResolvedValue({ id: 'message-1' }),
      },
      chatConversation: { findUnique: jest.fn().mockResolvedValue({
        status: ConversationStatus.AI_ACTIVE, isAiChat: true, stateVersion: 0, clientId: null,
      }), update: jest.fn().mockResolvedValue({ id: 'conversation-1' }) },
      outboxEvent: { create: jest.fn().mockResolvedValue({ id: 'outbox-2' }) },
    };
    prisma = { $queryRaw: jest.fn().mockResolvedValue([{ id: 'message-1', conversationId: 'conversation-1' }]) };
    bullMq = {
      getQueue: jest.fn().mockReturnValue({ add: jest.fn().mockResolvedValue({}) }),
      createWorker: jest.fn().mockReturnValue({ on: jest.fn() }),
    };
    worker = new AdministrativeAssistantRecoveryWorker(
      prisma as unknown as PrismaService,
      { withTransaction: jest.fn((work) => work(tx)) } as unknown as RlsTransactionService,
      bullMq as unknown as BullMqService,
    );
  });

  it('registers a recurring sweeper and stages a new durable attempt for a stale unanswered message', async () => {
    worker.onModuleInit();
    expect(bullMq.getQueue).toHaveBeenCalledWith('comms-chat-assistant-recovery');
    expect(bullMq.createWorker).toHaveBeenCalledWith('comms-chat-assistant-recovery', expect.any(Function));

    await worker.execute();

    expect(tx.commsChatMessage.update).toHaveBeenCalledWith({
      where: { id: 'message-1' },
      data: { metadata: expect.objectContaining({
        assistantStatus: 'QUEUED', dispatchAttempt: 1, queuedAt: expect.any(String),
      }) },
    });
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      aggregateId: 'message-1', eventType: 'comms.chat.assistant.processing_requested',
      status: 'PENDING_V2', deliveryLane: 'PENDING_V2',
    }) });
    expect(tx.chatConversation.update).toHaveBeenCalledWith({
      where: { id: 'conversation-1' },
      data: { assistantLeaseOwner: null, assistantLeaseExpiresAt: null },
    });
  });

  it('does not stage work when the response appeared or the conversation left AI_ACTIVE', async () => {
    tx.commsChatMessage.findUnique
      .mockReset()
      .mockResolvedValueOnce({
        id: 'message-1', conversationId: 'conversation-1', senderType: MessageSenderType.VISITOR,
        metadata: {
          assistantStatus: 'RETRYING', dispatchAttempt: 1, retryAttempts: 1, queuedAt: '2026-08-13T08:00:00.000Z',
          assistantStateVersion: 0, assistantClientId: null,
        },
      })
      .mockResolvedValueOnce({ id: 'response-1' });
    await worker.execute();
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();

    tx.commsChatMessage.findUnique
      .mockReset()
      .mockResolvedValueOnce({
        id: 'message-1', conversationId: 'conversation-1', senderType: MessageSenderType.VISITOR,
        metadata: {
          assistantStatus: 'RETRYING', dispatchAttempt: 1, retryAttempts: 1, queuedAt: '2026-08-13T08:00:00.000Z',
          assistantStateVersion: 0, assistantClientId: null,
        },
      })
      .mockResolvedValueOnce(null);
    tx.chatConversation.findUnique.mockResolvedValue({ status: ConversationStatus.STAFF_ACTIVE, isAiChat: true, stateVersion: 0, clientId: null });
    await worker.execute();
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('ends bounded transport recovery in a safe user-retryable state', async () => {
    tx.commsChatMessage.findUnique
      .mockReset()
      .mockResolvedValueOnce({
        id: 'message-1', conversationId: 'conversation-1', senderType: MessageSenderType.VISITOR,
        metadata: {
          assistantStatus: 'QUEUED', dispatchAttempt: 5, queuedAt: '2026-08-13T08:00:00.000Z',
          assistantStateVersion: 0, assistantClientId: null,
        },
      })
      .mockResolvedValueOnce(null);

    await worker.execute();

    expect(tx.commsChatMessage.update).toHaveBeenCalledWith({
      where: { id: 'message-1' },
      data: { metadata: expect.objectContaining({
        assistantStatus: 'RETRYABLE_FAILURE', retryable: true, dispatchAttempt: 5,
      }) },
    });
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
    expect(tx.chatConversation.update).toHaveBeenCalledWith({
      where: { id: 'conversation-1' },
      data: { assistantLeaseOwner: null, assistantLeaseExpiresAt: null },
    });
  });

  it('normalizes an old RETRYING marker without a dispatch epoch to a safe retryable state', async () => {
    tx.commsChatMessage.findUnique
      .mockReset()
      .mockResolvedValueOnce({
        id: 'message-1', conversationId: 'conversation-1', senderType: MessageSenderType.VISITOR,
        metadata: { assistantStatus: 'RETRYING', retryable: false },
      })
      .mockResolvedValueOnce(null);

    await worker.execute();

    expect(tx.commsChatMessage.update).toHaveBeenCalledWith({
      where: { id: 'message-1' },
      data: { metadata: expect.objectContaining({
        assistantStatus: 'RETRYABLE_FAILURE', retryable: true, dispatchAttempt: 0,
        assistantStateVersion: 0, assistantClientId: null,
      }) },
    });
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });
});
