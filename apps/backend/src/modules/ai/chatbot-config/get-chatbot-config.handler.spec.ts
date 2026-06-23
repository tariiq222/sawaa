import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { GetChatbotConfigHandler } from './get-chatbot-config.handler';

describe('GetChatbotConfigHandler', () => {
  let handler: GetChatbotConfigHandler;
  let prisma: { chatbotConfig: { findFirst: jest.Mock; create: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      chatbotConfig: { findFirst: jest.fn(), create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetChatbotConfigHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<GetChatbotConfigHandler>(GetChatbotConfigHandler);
  });

  it('returns the existing singleton row when one is configured', async () => {
    prisma.chatbotConfig.findFirst.mockResolvedValue({ id: 'cfg-1', greetingEn: 'Hi' });

    const result = await handler.execute();

    expect(result).toEqual({ id: 'cfg-1', greetingEn: 'Hi' });
    expect(prisma.chatbotConfig.create).not.toHaveBeenCalled();
  });

  it('lazily creates an empty singleton row on first read (upsert-on-read)', async () => {
    prisma.chatbotConfig.findFirst.mockResolvedValue(null);
    prisma.chatbotConfig.create.mockResolvedValue({ id: 'cfg-new' });

    const result = await handler.execute();

    expect(result).toEqual({ id: 'cfg-new' });
    expect(prisma.chatbotConfig.create).toHaveBeenCalledWith({ data: {} });
  });
});