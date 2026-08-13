import {
  ChatMessageKind,
  ConversationStatus,
  MessageSenderType,
  Prisma,
} from '@prisma/client';
import { Logger } from '@nestjs/common';
import { ChatAdapter } from '../../../../infrastructure/ai';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { GetChatbotConfigHandler } from '../../../ai/chatbot-config/get-chatbot-config.handler';
import { AdministrativeAssistantService } from './administrative-assistant.service';
import { AdministrativeToolsService } from './administrative-tools.service';

const messageId = '00000000-0000-4000-a000-000000000010';
const conversationId = '00000000-0000-4000-a000-000000000020';

const inboundMessage = {
  id: messageId,
  conversationId,
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
  let loggerWarn: jest.SpyInstance;
  let prisma: {
    commsChatMessage: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    chatConversation: { findUnique: jest.Mock };
  };
  let tx: {
    commsChatMessage: { findUnique: jest.Mock; create: jest.Mock };
    chatConversation: { findUnique: jest.Mock; updateMany: jest.Mock };
  };
  let transaction: { withTransaction: jest.Mock };
  let chat: { completeWithTools: jest.Mock; isAvailable: jest.Mock };
  let tools: { getDefinitions: jest.Mock; execute: jest.Mock };
  let config: { execute: jest.Mock };
  let service: AdministrativeAssistantService;

  beforeAll(() => {
    loggerWarn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterAll(() => {
    loggerWarn.mockRestore();
  });

  beforeEach(() => {
    const responseMessage = {
      id: 'response-1',
      conversationId,
      senderType: MessageSenderType.AI,
      body: 'نقدم خدمات إرشادية.',
      responseForMessageId: messageId,
    };
    prisma = {
      commsChatMessage: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.responseForMessageId) return null;
          return inboundMessage;
        }),
        findMany: jest.fn().mockResolvedValue([inboundMessage]),
        update: jest.fn().mockResolvedValue(inboundMessage),
      },
      chatConversation: {
        findUnique: jest.fn().mockResolvedValue(activeConversation),
      },
    };
    tx = {
      commsChatMessage: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(responseMessage),
      },
      chatConversation: {
        findUnique: jest.fn().mockResolvedValue(activeConversation),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    transaction = {
      withTransaction: jest.fn().mockImplementation((work) => work(tx)),
    };
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
    config = {
      execute: jest.fn().mockResolvedValue({ systemPromptAr: null, systemPromptEn: null }),
    };
    service = new AdministrativeAssistantService(
      prisma as unknown as PrismaService,
      transaction as unknown as RlsTransactionService,
      chat as unknown as ChatAdapter,
      tools as unknown as AdministrativeToolsService,
      config as unknown as GetChatbotConfigHandler,
    );
  });

  it('loads only the latest 20 unified messages and passes them in chronological order', async () => {
    const newestFirst = Array.from({ length: 20 }, (_, index) => ({
      ...inboundMessage,
      id: `message-${20 - index}`,
      senderType: index % 2 === 0 ? MessageSenderType.VISITOR : MessageSenderType.AI,
      body: `body-${20 - index}`,
    }));
    prisma.commsChatMessage.findMany.mockResolvedValue(newestFirst);

    await service.processMessage(messageId);

    expect(prisma.commsChatMessage.findMany).toHaveBeenCalledWith({
      where: {
        conversationId,
        senderType: { in: [MessageSenderType.CLIENT, MessageSenderType.VISITOR, MessageSenderType.AI] },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 20,
      select: { senderType: true, body: true },
    });
    const sentMessages = chat.completeWithTools.mock.calls[0][0];
    expect(sentMessages).toHaveLength(21);
    expect(sentMessages[1]).toEqual({ role: 'assistant', content: 'body-1' });
    expect(sentMessages[20]).toEqual({ role: 'user', content: 'body-20' });
  });

  it.each([
    ConversationStatus.WAITING_FOR_STAFF,
    ConversationStatus.STAFF_ACTIVE,
    ConversationStatus.CLOSED,
  ])('does not invoke AI while conversation status is %s', async (status) => {
    prisma.chatConversation.findUnique.mockResolvedValue({ ...activeConversation, status });

    await expect(service.processMessage(messageId)).resolves.toBeNull();

    expect(chat.completeWithTools).not.toHaveBeenCalled();
    expect(transaction.withTransaction).not.toHaveBeenCalled();
  });

  it('stops after four tool rounds and leaves the message retryable', async () => {
    chat.completeWithTools.mockResolvedValue({
      content: null,
      toolCalls: [{ id: 'call-1', function: { name: 'listServices', arguments: '{}' } }],
      tokensUsed: 3,
      model: 'test-model',
    });

    await expect(service.processMessage(messageId)).resolves.toBeNull();

    expect(chat.completeWithTools).toHaveBeenCalledTimes(4);
    expect(tools.execute).toHaveBeenCalledTimes(4);
    expect(tx.commsChatMessage.create).not.toHaveBeenCalled();
    expect(prisma.commsChatMessage.update).toHaveBeenCalledWith({
      where: { id: messageId },
      data: { metadata: { assistantStatus: 'RETRYABLE_FAILURE', retryable: true } },
    });
  });

  it('rechecks conversation status inside the save transaction and discards a stale AI reply', async () => {
    tx.chatConversation.findUnique.mockResolvedValue({
      ...activeConversation,
      status: ConversationStatus.STAFF_ACTIVE,
    });

    await expect(service.processMessage(messageId)).resolves.toBeNull();

    expect(chat.completeWithTools).toHaveBeenCalledTimes(1);
    expect(tx.commsChatMessage.create).not.toHaveBeenCalled();
    expect(tx.chatConversation.updateMany).not.toHaveBeenCalled();
  });

  it('returns an existing response without invoking AI', async () => {
    const existing = { id: 'existing-response', responseForMessageId: messageId };
    prisma.commsChatMessage.findUnique.mockResolvedValueOnce(existing);

    await expect(service.processMessage(messageId)).resolves.toEqual(existing);

    expect(chat.completeWithTools).not.toHaveBeenCalled();
    expect(transaction.withTransaction).not.toHaveBeenCalled();
  });

  it('reads the winning response after a P2002 race without incrementing counters twice', async () => {
    const winner = { id: 'race-winner', responseForMessageId: messageId };
    tx.commsChatMessage.create.mockRejectedValue(duplicateError());
    prisma.commsChatMessage.findUnique
      .mockImplementationOnce(() => null)
      .mockImplementationOnce(() => inboundMessage)
      .mockImplementationOnce(() => winner);

    await expect(service.processMessage(messageId)).resolves.toEqual(winner);

    expect(tx.chatConversation.updateMany).not.toHaveBeenCalled();
  });

  it('marks provider failure as retryable without persisting the raw error', async () => {
    chat.completeWithTools.mockRejectedValue(new Error('provider secret and upstream trace'));

    await expect(service.processMessage(messageId)).resolves.toBeNull();

    expect(prisma.commsChatMessage.update).toHaveBeenCalledWith({
      where: { id: messageId },
      data: { metadata: { assistantStatus: 'RETRYABLE_FAILURE', retryable: true } },
    });
    expect(JSON.stringify(prisma.commsChatMessage.update.mock.calls)).not.toContain('provider secret');
    expect(tx.commsChatMessage.create).not.toHaveBeenCalled();
  });

  it('persists one unified AI response and increments client unread count once in the same transaction', async () => {
    await expect(service.processMessage(messageId)).resolves.toEqual(expect.objectContaining({ id: 'response-1' }));

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
    expect(tx.chatConversation.updateMany).toHaveBeenCalledWith({
      where: { id: conversationId, status: ConversationStatus.AI_ACTIVE, isAiChat: true },
      data: {
        lastMessageAt: expect.any(Date),
        clientUnreadCount: { increment: 1 },
      },
    });
  });
});
