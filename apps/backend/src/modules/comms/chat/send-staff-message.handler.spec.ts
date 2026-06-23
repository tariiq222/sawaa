import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConversationStatus, MessageSenderType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { SendStaffMessageHandler } from './send-staff-message.handler';

describe('SendStaffMessageHandler', () => {
  let handler: SendStaffMessageHandler;
  let prisma: {
    chatConversation: { findFirst: jest.Mock; update: jest.Mock };
    commsChatMessage: { create: jest.Mock };
    employee: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      chatConversation: { findFirst: jest.fn(), update: jest.fn() },
      commsChatMessage: { create: jest.fn() },
      employee: { findFirst: jest.fn() },
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

  // AUTHZ-004 / COMMS-004: EMPLOYEE callers may only send into assigned chats.
  it('forbids an EMPLOYEE from sending into a conversation assigned to another counselor', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue({
      id: 'c1',
      employeeId: 'emp-B',
      status: ConversationStatus.OPEN,
    });
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-A' });

    await expect(
      handler.execute({
        conversationId: 'c1',
        staffId: 'user-A',
        body: 'hi',
        requesterRole: 'EMPLOYEE',
        requesterUserId: 'user-A',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.commsChatMessage.create).not.toHaveBeenCalled();
    expect(prisma.chatConversation.update).not.toHaveBeenCalled();
  });

  it('allows an EMPLOYEE to send into a conversation assigned to them', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue({
      id: 'c1',
      employeeId: 'emp-A',
      status: ConversationStatus.OPEN,
    });
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-A' });
    prisma.commsChatMessage.create.mockResolvedValue({ id: 'msg-1' });

    const result = await handler.execute({
      conversationId: 'c1',
      staffId: 'user-A',
      body: 'hello',
      requesterRole: 'EMPLOYEE',
      requesterUserId: 'user-A',
    });
    expect(result).toEqual({ id: 'msg-1' });
    expect(prisma.commsChatMessage.create).toHaveBeenCalled();
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