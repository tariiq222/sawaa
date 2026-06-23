import { Test, TestingModule } from '@nestjs/testing';
import { ConversationStatus, MessageSenderType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { CloseConversationHandler } from './close-conversation.handler';

describe('CloseConversationHandler', () => {
  let handler: CloseConversationHandler;
  let prisma: { chatConversation: { findFirst: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    prisma = { chatConversation: { findFirst: jest.fn(), update: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloseConversationHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<CloseConversationHandler>(CloseConversationHandler);
  });

  it('throws when the conversation does not exist', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute({ conversationId: '00000000-0000-0000-0000-000000000001' }),
    ).rejects.toThrow();
    expect(prisma.chatConversation.update).not.toHaveBeenCalled();
  });

  it('returns the existing row unchanged when already CLOSED (idempotent)', async () => {
    const row = { id: 'c1', status: ConversationStatus.CLOSED };
    prisma.chatConversation.findFirst.mockResolvedValue(row);

    const result = await handler.execute({ conversationId: 'c1' });

    expect(result).toBe(row);
    expect(prisma.chatConversation.update).not.toHaveBeenCalled();
  });

  it('updates an OPEN conversation to CLOSED', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue({
      id: 'c1',
      status: ConversationStatus.OPEN,
    });
    prisma.chatConversation.update.mockResolvedValue({
      id: 'c1',
      status: ConversationStatus.CLOSED,
    });

    await handler.execute({ conversationId: 'c1' });

    expect(prisma.chatConversation.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { status: ConversationStatus.CLOSED },
    });
  });
});