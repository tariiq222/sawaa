import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { GetConversationHandler } from './get-conversation.handler';

describe('GetConversationHandler', () => {
  let handler: GetConversationHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetConversationHandler,
        { provide: PrismaService, useValue: {
    chatConversation: { findFirst: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<GetConversationHandler>(GetConversationHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.chatConversation.findFirst as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute({conversationId:"00000000-0000-0000-0000-000000000001"});
    expect(result).toBeDefined();
    
    (prisma.chatConversation.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({conversationId:"00000000-0000-0000-0000-000000000001"})).rejects.toThrow();
  });
});
