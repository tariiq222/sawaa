import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ChatCompletionHandler } from './chat-completion.handler';
import { PrismaService } from '../../../infrastructure/database';
import { ChatAdapter } from '../../../infrastructure/ai';
import { SemanticSearchHandler } from '../semantic-search/semantic-search.handler';
import { GetChatbotConfigHandler } from '../chatbot-config/get-chatbot-config.handler';

describe('ChatCompletionHandler', () => {
  let handler: ChatCompletionHandler;
  let prisma: PrismaService;
  let chat: ChatAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatCompletionHandler,
        {
          provide: PrismaService,
          useValue: {
            chatSession: { create: jest.fn().mockResolvedValue({ id: 'session-1' }) },
            chatMessage: {
              create: jest.fn().mockResolvedValue({}),
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
        {
          provide: SemanticSearchHandler,
          useValue: {
            execute: jest.fn().mockResolvedValue([{ content: 'Context' }]),
          },
        },
        {
          provide: ChatAdapter,
          useValue: {
            isAvailable: jest.fn().mockReturnValue(true),
            complete: jest.fn().mockResolvedValue({ content: 'Reply', tokensUsed: 10, model: 'test' }),
          },
        },
        {
          provide: GetChatbotConfigHandler,
          useValue: {
            execute: jest.fn().mockResolvedValue({ systemPromptAr: null, systemPromptEn: null }),
          },
        },
      ],
    }).compile();

    handler = module.get<ChatCompletionHandler>(ChatCompletionHandler);
    prisma = module.get<PrismaService>(PrismaService);
    chat = module.get<ChatAdapter>(ChatAdapter);
  });

  it('should complete with new session', async () => {
    const result = await handler.execute({ userMessage: 'Hello', clientId: 'c1', userId: 'u1' });
    expect(result.reply).toBe('Reply');
    expect(result.sessionId).toBe('session-1');
  });

  it('should complete with existing session', async () => {
    const result = await handler.execute({ userMessage: 'Hello', clientId: 'c1', userId: 'u1', sessionId: 'session-2' });
    expect(result.reply).toBe('Reply');
    expect(prisma.chatSession.create).not.toHaveBeenCalled();
  });

  it('should throw when chat not available', async () => {
    (chat.isAvailable as jest.Mock).mockReturnValue(false);
    await expect(handler.execute({ userMessage: 'Hello', clientId: 'c1', userId: 'u1' })).rejects.toThrow(BadRequestException);
  });

  it('should throw on AI error', async () => {
    (chat.complete as jest.Mock).mockRejectedValue(new Error('API error'));
    await expect(handler.execute({ userMessage: 'Hello', clientId: 'c1', userId: 'u1' })).rejects.toThrow(ServiceUnavailableException);
  });
});
