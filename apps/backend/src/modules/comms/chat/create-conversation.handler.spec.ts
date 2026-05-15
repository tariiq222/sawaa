import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { CreateConversationHandler } from './create-conversation.handler';

describe('CreateConversationHandler', () => {
  let handler: CreateConversationHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateConversationHandler,
        { provide: PrismaService, useValue: {
    chatConversation: { findFirst: jest.fn(), create: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<CreateConversationHandler>(CreateConversationHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.chatConversation.findFirst as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute({employeeId:"00000000-0000-0000-0000-000000000001",clientId:"00000000-0000-0000-0000-000000000001"});
    expect(result).toBeDefined();
  });
});
