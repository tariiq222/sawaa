import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConversationStatus, MessageSenderType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { SendStaffMessageHandler } from './send-staff-message.handler';

describe('SendStaffMessageHandler', () => {
  let handler: SendStaffMessageHandler;
  let prisma: {
    chatConversation: { findFirst: jest.Mock; update: jest.Mock };
    commsChatMessage: { create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      chatConversation: { findFirst: jest.fn(), update: jest.fn() },
      commsChatMessage: { create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SendStaffMessageHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<SendStaffMessageHandler>(SendStaffMessageHandler);
  });

  it('throws NotFoundException when the conversation does not exist', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute({ conversationId: 'missing', staffId: 's1', body: 'hi' }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.commsChatMessage.create).not.toHaveBeenCalled();
    expect(prisma.chatConversation.update).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when the conversation is already CLOSED', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue({
      id: 'c1',
      status: ConversationStatus.CLOSED,
    });

    await expect(
      handler.execute({ conversationId: 'c1', staffId: 's1', body: 'hi' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.commsChatMessage.create).not.toHaveBeenCalled();
  });

  it('persists the message and bumps lastMessageAt on the conversation', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue({
      id: 'c1',
      status: ConversationStatus.OPEN,
    });
    prisma.commsChatMessage.create.mockResolvedValue({ id: 'msg-1' });

    await handler.execute({ conversationId: 'c1', staffId: 's1', body: 'hello' });

    expect(prisma.commsChatMessage.create).toHaveBeenCalledWith({
      data: {
        conversationId: 'c1',
        senderType: MessageSenderType.EMPLOYEE,
        senderId: 's1',
        body: 'hello',
      },
    });
    expect(prisma.chatConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c1' },
        data: { lastMessageAt: expect.any(Date) },
      }),
    );
  });
});