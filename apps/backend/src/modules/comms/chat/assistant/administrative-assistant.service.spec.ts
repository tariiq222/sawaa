import { Logger } from '@nestjs/common';
import {
  ChatMessageKind,
  ConversationStatus,
  MessageSenderType,
  Prisma,
} from '@prisma/client';
import { ChatAdapter } from '../../../../infrastructure/ai';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { AdministrativeAssistantLeaseService } from './administrative-assistant-lease.service';
import { AdministrativeAssistantService } from './administrative-assistant.service';
import { AdministrativeOutputValidator } from './administrative-output-validator';
import { AdministrativeScopeGate } from './administrative-scope-gate';
import { AdministrativeToolsService } from './administrative-tools.service';

const messageId = '00000000-0000-4000-a000-000000000010';
const conversationId = '00000000-0000-4000-a000-000000000020';

const inboundMessage = {
  id: messageId,
  conversationId,
  sequence: 2n,
  senderType: MessageSenderType.VISITOR,
  senderId: null,
  body: 'ما الخدمات المتاحة؟',
  metadata: null,
  createdAt: new Date('2026-08-13T08:00:00.000Z'),
};

const activeConversation = {
  id: conversationId,
  clientId: null,
  language: 'ar',
  isAiChat: true,
  status: ConversationStatus.AI_ACTIVE,
};

function duplicateError(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('duplicate response', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

describe('AdministrativeAssistantService', () => {
  let prisma: {
    commsChatMessage: { findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    chatConversation: { findUnique: jest.Mock };
  };
  let tx: {
    commsChatMessage: { findUnique: jest.Mock; create: jest.Mock };
    chatConversation: { findUnique: jest.Mock; updateMany: jest.Mock };
  };
  let transaction: { withTransaction: jest.Mock };
  let chat: { completeWithTools: jest.Mock; isAvailable: jest.Mock };
  let tools: { getDefinitions: jest.Mock; execute: jest.Mock };
  let lease: { acquire: jest.Mock; renew: jest.Mock; release: jest.Mock };
  let service: AdministrativeAssistantService;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    prisma = {
      commsChatMessage: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.responseForMessageId) return null;
          return inboundMessage;
        }),
        findMany: jest.fn().mockImplementation(({ select }) => {
          if (select.id) return [inboundMessage];
          return [inboundMessage];
        }),
        update: jest.fn().mockResolvedValue(inboundMessage),
      },
      chatConversation: { findUnique: jest.fn().mockResolvedValue(activeConversation) },
    };
    tx = {
      commsChatMessage: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({
          id: `response-${data.responseForMessageId}`,
          ...data,
        })),
      },
      chatConversation: {
        findUnique: jest.fn().mockResolvedValue(activeConversation),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    transaction = { withTransaction: jest.fn().mockImplementation((work) => work(tx)) };
    chat = {
      isAvailable: jest.fn().mockReturnValue(true),
      completeWithTools: jest.fn().mockResolvedValue({
        content: 'نقدم خدمات إرشادية.',
        toolCalls: [],
        tokensUsed: 12,
        model: 'test-model',
      }),
    };
    tools = {
      getDefinitions: jest.fn().mockReturnValue([{ type: 'function', function: { name: 'listServices' } }]),
      execute: jest.fn().mockResolvedValue({ ok: true, data: [{ id: 'service-1' }] }),
    };
    lease = {
      acquire: jest.fn().mockResolvedValue(true),
      renew: jest.fn().mockResolvedValue(true),
      release: jest.fn().mockResolvedValue(undefined),
    };
    service = new AdministrativeAssistantService(
      prisma as unknown as PrismaService,
      transaction as unknown as RlsTransactionService,
      chat as unknown as ChatAdapter,
      tools as unknown as AdministrativeToolsService,
      lease as unknown as AdministrativeAssistantLeaseService,
      new AdministrativeScopeGate(),
      new AdministrativeOutputValidator(),
    );
  });

  it('answers out-of-scope input deterministically without invoking AI or tools', async () => {
    prisma.commsChatMessage.findUnique.mockImplementation(({ where }) => {
      if (where.responseForMessageId) return null;
      return { ...inboundMessage, body: 'شخص حالتي' };
    });
    prisma.commsChatMessage.findMany.mockImplementation(({ select }) => select.id
      ? [{ ...inboundMessage, body: 'شخص حالتي' }]
      : []);

    await service.processMessage(messageId);

    expect(chat.completeWithTools).not.toHaveBeenCalled();
    expect(tools.execute).not.toHaveBeenCalled();
    expect(tx.commsChatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        body: 'عذرًا، يقتصر دوري على المعلومات الإدارية عن المركز وخدماته. يمكنني عرض خيار التحويل إلى الاستقبال.',
        metadata: { action: 'OFFER_HANDOFF', reason: 'OUT_OF_SCOPE' },
      }),
    });
  });

  it('targets history by sequence and enforces max20 plus a 12k character budget', async () => {
    const newestFirst = Array.from({ length: 20 }, (_, index) => ({
      senderType: index % 2 === 0 ? MessageSenderType.VISITOR : MessageSenderType.AI,
      body: `${20 - index}-${'x'.repeat(999)}`,
      sequence: BigInt(20 - index),
    }));
    prisma.commsChatMessage.findMany.mockImplementation(({ select }) => select.id
      ? [inboundMessage]
      : newestFirst);

    await service.processMessage(messageId);

    expect(prisma.commsChatMessage.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        conversationId,
        sequence: { lte: 2n },
      }),
      orderBy: { sequence: 'desc' },
      take: 20,
      select: { senderType: true, body: true, sequence: true },
    }));
    const sent = chat.completeWithTools.mock.calls[0][0].slice(1);
    expect(sent).toHaveLength(12);
    expect(sent.reduce((sum: number, item: { content: string }) => sum + item.content.length, 0)).toBeLessThanOrEqual(12_000);
    expect(sent[0].content.startsWith('9-')).toBe(true);
    expect(sent[11].content.startsWith('20-')).toBe(true);
  });

  it.each([
    ConversationStatus.WAITING_FOR_STAFF,
    ConversationStatus.STAFF_ACTIVE,
    ConversationStatus.CLOSED,
  ])('does not acquire a lease or invoke AI while status is %s', async (status) => {
    prisma.chatConversation.findUnique.mockResolvedValue({ ...activeConversation, status });

    await expect(service.processMessage(messageId)).resolves.toBeNull();

    expect(lease.acquire).not.toHaveBeenCalled();
    expect(chat.completeWithTools).not.toHaveBeenCalled();
  });

  it('does nothing when another worker owns the unexpired conversation lease', async () => {
    lease.acquire.mockResolvedValue(false);

    await expect(service.processMessage(messageId)).resolves.toBeNull();

    expect(chat.completeWithTools).not.toHaveBeenCalled();
    expect(lease.release).not.toHaveBeenCalled();
  });

  it('does not save a completion after lease ownership expires during the provider call', async () => {
    lease.renew.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(service.processMessage(messageId)).resolves.toBeNull();

    expect(chat.completeWithTools).toHaveBeenCalledTimes(1);
    expect(tx.commsChatMessage.create).not.toHaveBeenCalled();
    expect(prisma.commsChatMessage.update).not.toHaveBeenCalled();
    expect(lease.release).toHaveBeenCalledTimes(1);
  });

  it('processes M1 then M2 when the M2 worker acquires the lease first', async () => {
    const first = { ...inboundMessage, id: 'message-1', sequence: 1n, body: 'ما الخدمات؟' };
    const second = { ...inboundMessage, id: 'message-2', sequence: 2n, body: 'ما المواعيد المتاحة؟' };
    prisma.commsChatMessage.findUnique.mockImplementation(({ where }) => {
      if (where.responseForMessageId) return null;
      return second;
    });
    prisma.commsChatMessage.findMany.mockImplementation(({ select }) => select.id
      ? [first, second]
      : [second, first]);
    chat.completeWithTools
      .mockResolvedValueOnce({ content: 'هذه خدماتنا.', toolCalls: [], tokensUsed: 2, model: 'm' })
      .mockResolvedValueOnce({ content: 'هذه مواعيدنا.', toolCalls: [], tokensUsed: 2, model: 'm' });

    const result = await service.processMessage('message-2');

    expect(tx.commsChatMessage.create.mock.calls.map(([call]) => call.data.responseForMessageId)).toEqual([
      'message-1',
      'message-2',
    ]);
    expect(result).toEqual(expect.objectContaining({ responseForMessageId: 'message-2' }));
    expect(lease.release).toHaveBeenCalledTimes(1);
  });

  it('marks the currently failing earlier message retryable and does not mark the later target', async () => {
    const first = { ...inboundMessage, id: 'message-1', sequence: 1n, body: 'ما الخدمات؟' };
    const second = { ...inboundMessage, id: 'message-2', sequence: 2n, body: 'ما المواعيد المتاحة؟' };
    prisma.commsChatMessage.findUnique.mockImplementation(({ where }) => {
      if (where.responseForMessageId) return null;
      return second;
    });
    prisma.commsChatMessage.findMany.mockImplementation(({ select }) => select.id
      ? [first, second]
      : [second, first]);
    chat.completeWithTools.mockRejectedValueOnce(new Error('provider failure'));

    await expect(service.processMessage('message-2')).resolves.toBeNull();

    expect(prisma.commsChatMessage.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'message-1' },
    }));
    expect(prisma.commsChatMessage.update).not.toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'message-2' },
    }));
  });

  it('stops before M2 when conversation status changes while saving M1', async () => {
    const first = { ...inboundMessage, id: 'message-1', sequence: 1n, body: 'ما الخدمات؟' };
    const second = { ...inboundMessage, id: 'message-2', sequence: 2n, body: 'ما المواعيد المتاحة؟' };
    prisma.commsChatMessage.findUnique.mockImplementation(({ where }) => {
      if (where.responseForMessageId) return null;
      return second;
    });
    prisma.commsChatMessage.findMany.mockImplementation(({ select }) => select.id
      ? [first, second]
      : [second, first]);
    tx.chatConversation.findUnique.mockResolvedValue({
      ...activeConversation,
      status: ConversationStatus.STAFF_ACTIVE,
    });

    await expect(service.processMessage('message-2')).resolves.toBeNull();

    expect(chat.completeWithTools).toHaveBeenCalledTimes(1);
    expect(tx.commsChatMessage.create).not.toHaveBeenCalled();
  });

  it('limits tool calls to three per round without executing overflow calls', async () => {
    chat.completeWithTools.mockResolvedValue({
      content: null,
      toolCalls: Array.from({ length: 4 }, (_, index) => ({
        id: `call-${index}`,
        function: { name: 'listServices', arguments: '{}' },
      })),
      tokensUsed: 3,
      model: 'test-model',
    });

    await service.processMessage(messageId);

    expect(tools.execute).not.toHaveBeenCalled();
    expect(tx.commsChatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: { action: 'OFFER_HANDOFF', reason: 'LIMIT_REACHED' },
      }),
    });
  });

  it('limits total tool calls to eight and performs no calls after the limit is detected', async () => {
    chat.completeWithTools.mockResolvedValue({
      content: null,
      toolCalls: Array.from({ length: 3 }, (_, index) => ({
        id: `call-${index}`,
        function: { name: 'listServices', arguments: '{}' },
      })),
      tokensUsed: 3,
      model: 'test-model',
    });

    await service.processMessage(messageId);

    expect(chat.completeWithTools).toHaveBeenCalledTimes(3);
    expect(tools.execute).toHaveBeenCalledTimes(6);
    expect(tx.commsChatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ metadata: { action: 'OFFER_HANDOFF', reason: 'LIMIT_REACHED' } }),
    });
  });

  it('replaces malicious model output before saving', async () => {
    chat.completeWithTools.mockResolvedValue({
      content: 'Diagnosis: severe condition. Go to emergency care.',
      toolCalls: [],
      tokensUsed: 8,
      model: 'malicious-model',
    });

    await service.processMessage(messageId);

    expect(tx.commsChatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        body: expect.not.stringMatching(/diagnos|emergency/i),
        metadata: { action: 'OFFER_HANDOFF', reason: 'OUT_OF_SCOPE' },
      }),
    });
  });

  it('rechecks status inside the save transaction and discards a stale reply', async () => {
    tx.chatConversation.findUnique.mockResolvedValue({ ...activeConversation, status: ConversationStatus.STAFF_ACTIVE });

    await expect(service.processMessage(messageId)).resolves.toBeNull();

    expect(tx.commsChatMessage.create).not.toHaveBeenCalled();
    expect(tx.chatConversation.updateMany).not.toHaveBeenCalled();
  });

  it('returns an existing response without invoking AI', async () => {
    const existing = { id: 'existing-response', responseForMessageId: messageId };
    prisma.commsChatMessage.findUnique.mockImplementation(({ where }) => {
      if (where.responseForMessageId) return existing;
      return inboundMessage;
    });

    await expect(service.processMessage(messageId)).resolves.toEqual(existing);

    expect(chat.completeWithTools).not.toHaveBeenCalled();
  });

  it('reads the winning response after a same-message P2002 race without a second counter update', async () => {
    const winner = { id: 'race-winner', responseForMessageId: messageId };
    tx.commsChatMessage.create.mockRejectedValue(duplicateError());
    let responseReads = 0;
    prisma.commsChatMessage.findUnique.mockImplementation(({ where }) => {
      if (where.responseForMessageId) {
        responseReads += 1;
        return responseReads >= 3 ? winner : null;
      }
      return inboundMessage;
    });

    await expect(service.processMessage(messageId)).resolves.toEqual(winner);

    expect(tx.chatConversation.updateMany).not.toHaveBeenCalled();
  });

  it('merges safe metadata on provider failure without persisting the raw error and releases the lease', async () => {
    const withMetadata = {
      ...inboundMessage,
      metadata: { action: 'OFFER_HANDOFF', reason: 'USER_REQUESTED', providerTrace: 'discard-me' },
    };
    prisma.commsChatMessage.findUnique.mockImplementation(({ where }) => where.responseForMessageId ? null : withMetadata);
    prisma.commsChatMessage.findMany.mockImplementation(({ select }) => select.id ? [withMetadata] : [withMetadata]);
    chat.completeWithTools.mockRejectedValue(new Error('provider secret and upstream trace'));

    await expect(service.processMessage(messageId)).resolves.toBeNull();

    expect(prisma.commsChatMessage.update).toHaveBeenCalledWith({
      where: { id: messageId },
      data: {
        metadata: {
          action: 'OFFER_HANDOFF',
          reason: 'USER_REQUESTED',
          assistantStatus: 'RETRYABLE_FAILURE',
          retryable: true,
        },
      },
    });
    expect(JSON.stringify(prisma.commsChatMessage.update.mock.calls)).not.toMatch(/provider secret|discard-me/);
    expect(lease.release).toHaveBeenCalledTimes(1);
  });

  it('persists one unified AI response and increments client unread once in the same short transaction', async () => {
    await service.processMessage(messageId);

    expect(transaction.withTransaction).toHaveBeenCalledTimes(1);
    expect(tx.commsChatMessage.create).toHaveBeenCalledWith({
      data: {
        conversationId,
        senderType: MessageSenderType.AI,
        senderId: null,
        body: 'نقدم خدمات إرشادية.',
        kind: ChatMessageKind.TEXT,
        metadata: Prisma.JsonNull,
        responseForMessageId: messageId,
        model: 'test-model',
        tokensUsed: 12,
        latencyMs: expect.any(Number),
      },
    });
    expect(tx.chatConversation.updateMany).toHaveBeenCalledTimes(1);
  });
});
