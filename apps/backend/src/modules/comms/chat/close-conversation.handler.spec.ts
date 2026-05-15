import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { CloseConversationHandler } from './close-conversation.handler';

describe('CloseConversationHandler', () => {
  let handler: CloseConversationHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloseConversationHandler,
        { provide: PrismaService, useValue: {
    chatConversation: { findFirst: jest.fn(), update: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<CloseConversationHandler>(CloseConversationHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    (prisma.chatConversation.findFirst as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({conversationId:"00000000-0000-0000-0000-000000000001"});
    
    (prisma.chatConversation.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({conversationId:"00000000-0000-0000-0000-000000000001"})).rejects.toThrow();
  });
});
