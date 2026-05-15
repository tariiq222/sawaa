import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CreateChatMessageHandler } from './create-chat-message.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('CreateChatMessageHandler', () => {
  let handler: CreateChatMessageHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      chatConversation: { findFirst: jest.fn(), update: jest.fn() },
      commsChatMessage: { create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CreateChatMessageHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();

    handler = module.get<CreateChatMessageHandler>(CreateChatMessageHandler);
  });

  it('should throw NotFoundException when conversation not found', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ conversationId: 'conv-1', senderType: 'CLIENT', body: 'hi' })).rejects.toThrow(NotFoundException);
  });

  it('should create message with senderId and update conversation', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue({ id: 'conv-1' });
    prisma.commsChatMessage.create.mockResolvedValue({ id: 'msg-1', body: 'hi' });
    prisma.chatConversation.update.mockResolvedValue({ id: 'conv-1' });

    const result = await handler.execute({ conversationId: 'conv-1', senderType: 'CLIENT', senderId: 'client-1', body: 'hi' });
    expect(prisma.commsChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ senderId: 'client-1', body: 'hi' }),
    }));
    expect(prisma.chatConversation.update).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: { lastMessageAt: expect.any(Date) },
    });
    expect(result.id).toBe('msg-1');
  });

  it('should create message without senderId', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue({ id: 'conv-1' });
    prisma.commsChatMessage.create.mockResolvedValue({ id: 'msg-1' });

    await handler.execute({ conversationId: 'conv-1', senderType: 'SYSTEM', body: 'welcome' });
    expect(prisma.commsChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ senderId: null }),
    }));
  });
});
