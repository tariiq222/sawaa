import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { GetChatbotConfigHandler } from './get-chatbot-config.handler';

describe('GetChatbotConfigHandler', () => {
  let handler: GetChatbotConfigHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetChatbotConfigHandler,
        { provide: PrismaService, useValue: {
    chatbotConfig: { findFirst: jest.fn(), create: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<GetChatbotConfigHandler>(GetChatbotConfigHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.chatbotConfig.findFirst as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute();
    expect(result).toBeDefined();
  });
});
