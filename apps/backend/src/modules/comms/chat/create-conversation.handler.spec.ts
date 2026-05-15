import { Test, TestingModule } from '@nestjs/testing';
import { ConversationStatus } from '@prisma/client';
import { CreateConversationHandler } from './create-conversation.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('CreateConversationHandler', () => {
  let handler: CreateConversationHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      chatConversation: { findFirst: jest.fn(), create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CreateConversationHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();

    handler = module.get<CreateConversationHandler>(CreateConversationHandler);
  });

  it('should return existing conversation when found', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue({ id: 'conv-1' });
    const result = await handler.execute({ clientId: 'client-1', employeeId: 'emp-1' });
    expect(result.id).toBe('conv-1');
    expect(prisma.chatConversation.create).not.toHaveBeenCalled();
  });

  it('should create new conversation with employee', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue(null);
    prisma.chatConversation.create.mockResolvedValue({ id: 'conv-2', isAiChat: false });

    const result = await handler.execute({ clientId: 'client-1', employeeId: 'emp-1' });
    expect(prisma.chatConversation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ clientId: 'client-1', employeeId: 'emp-1', isAiChat: false }),
    }));
    expect(result.isAiChat).toBe(false);
  });

  it('should create AI conversation when no employeeId', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue(null);
    prisma.chatConversation.create.mockResolvedValue({ id: 'conv-3', isAiChat: true });

    const result = await handler.execute({ clientId: 'client-1' });
    expect(prisma.chatConversation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ clientId: 'client-1', employeeId: null, isAiChat: true }),
    }));
    expect(result.isAiChat).toBe(true);
  });
});
