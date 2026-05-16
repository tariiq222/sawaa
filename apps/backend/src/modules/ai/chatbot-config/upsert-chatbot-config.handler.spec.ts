import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { UpsertChatbotConfigHandler } from './upsert-chatbot-config.handler';

describe('UpsertChatbotConfigHandler', () => {
  let handler: UpsertChatbotConfigHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpsertChatbotConfigHandler,
        { provide: PrismaService, useValue: {
    chatbotConfig: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<UpsertChatbotConfigHandler>(UpsertChatbotConfigHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    (prisma.chatbotConfig.findFirst as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({systemPromptAr:"test",systemPromptEn:"test",greetingAr:"test",greetingEn:"test",escalateToHumanAt:3,settings:{} as any});
  });
});
