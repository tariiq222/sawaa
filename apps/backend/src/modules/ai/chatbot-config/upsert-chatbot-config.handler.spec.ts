import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { UpsertChatbotConfigHandler } from './upsert-chatbot-config.handler';

describe('UpsertChatbotConfigHandler', () => {
  let handler: UpsertChatbotConfigHandler;
  let prisma: { chatbotConfig: { findFirst: jest.Mock; update: jest.Mock; create: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      chatbotConfig: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'cfg-1' }),
        create: jest.fn().mockResolvedValue({ id: 'cfg-new' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpsertChatbotConfigHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<UpsertChatbotConfigHandler>(UpsertChatbotConfigHandler);
  });

  it('updates the singleton row when one already exists', async () => {
    prisma.chatbotConfig.findFirst.mockResolvedValue({ id: 'cfg-1' });

    await handler.execute({
      systemPromptAr: 'مرحبا',
      systemPromptEn: 'Hello',
    } as never);

    expect(prisma.chatbotConfig.update).toHaveBeenCalledWith({
      where: { id: 'cfg-1' },
      data: { systemPromptAr: 'مرحبا', systemPromptEn: 'Hello' },
    });
    expect(prisma.chatbotConfig.create).not.toHaveBeenCalled();
  });

  it('creates a new singleton row when none exists', async () => {
    prisma.chatbotConfig.findFirst.mockResolvedValue(null);

    await handler.execute({
      systemPromptAr: 'مرحبا',
      greetingEn: 'Hi there',
      escalateToHumanAt: 4,
    } as never);

    expect(prisma.chatbotConfig.create).toHaveBeenCalledWith({
      data: { systemPromptAr: 'مرحبا', greetingEn: 'Hi there', escalateToHumanAt: 4 },
    });
    expect(prisma.chatbotConfig.update).not.toHaveBeenCalled();
  });

  it('does not overwrite fields that are not in the command (partial update)', async () => {
    prisma.chatbotConfig.findFirst.mockResolvedValue({ id: 'cfg-1' });

    await handler.execute({ greetingAr: 'أهلا' } as never);

    expect(prisma.chatbotConfig.update).toHaveBeenCalledWith({
      where: { id: 'cfg-1' },
      data: { greetingAr: 'أهلا' },
    });
  });
});