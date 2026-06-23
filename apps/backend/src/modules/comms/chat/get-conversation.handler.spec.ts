import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConversationStatus, MessageSenderType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { GetConversationHandler } from './get-conversation.handler';

describe('GetConversationHandler', () => {
  let handler: GetConversationHandler;
  let prisma: {
    chatConversation: { findFirst: jest.Mock };
    client: { findFirst: jest.Mock };
    employee: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      chatConversation: { findFirst: jest.fn() },
      client: { findFirst: jest.fn().mockResolvedValue(null) },
      employee: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetConversationHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get<GetConversationHandler>(GetConversationHandler);
  });

  it('throws NotFoundException when the conversation is missing', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue(null);

    await expect(handler.execute({ conversationId: 'missing' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns the conversation with messages mapped by sender type', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue({
      id: 'c1',
      clientId: 'u1',
      employeeId: 'e1',
      status: ConversationStatus.OPEN,
      createdAt: new Date('2026-05-20T10:00:00Z'),
      updatedAt: new Date('2026-05-20T11:00:00Z'),
      lastMessageAt: new Date('2026-05-20T10:30:00Z'),
      messages: [
        {
          id: 'm1',
          conversationId: 'c1',
          senderType: MessageSenderType.CLIENT,
          body: 'hi',
          createdAt: new Date('2026-05-20T10:00:00Z'),
        },
        {
          id: 'm2',
          conversationId: 'c1',
          senderType: MessageSenderType.EMPLOYEE,
          body: 'hello',
          createdAt: new Date('2026-05-20T10:01:00Z'),
        },
        {
          id: 'm3',
          conversationId: 'c1',
          senderType: MessageSenderType.AI,
          body: 'auto-reply',
          createdAt: new Date('2026-05-20T10:02:00Z'),
        },
      ],
    });

    const result = await handler.execute({ conversationId: 'c1' });

    expect(result.id).toBe('c1');
    expect(result.handedOff).toBe(true);
    expect(result.endedAt).toBeNull();
    expect(result.messages.map((m) => m.role)).toEqual(['user', 'staff', 'assistant']);
    expect(result.messages.map((m) => m.content)).toEqual(['hi', 'hello', 'auto-reply']);
  });

  it('returns endedAt=updatedAt when conversation is CLOSED', async () => {
    const updatedAt = new Date('2026-05-20T11:00:00Z');
    prisma.chatConversation.findFirst.mockResolvedValue({
      id: 'c1',
      clientId: 'u1',
      employeeId: null,
      status: ConversationStatus.CLOSED,
      createdAt: new Date('2026-05-20T10:00:00Z'),
      updatedAt,
      lastMessageAt: null,
      messages: [],
    });

    const result = await handler.execute({ conversationId: 'c1' });

    expect(result.handedOff).toBe(false);
    expect(result.endedAt).toEqual(updatedAt);
  });

  // AUTHZ-004 / COMMS-004: EMPLOYEE callers may only read their assigned chats.
  it('forbids an EMPLOYEE from reading a conversation assigned to another counselor', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue({
      id: 'c1',
      clientId: 'u1',
      employeeId: 'emp-B', // assigned to a different counselor
      status: ConversationStatus.OPEN,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastMessageAt: null,
      messages: [],
    });
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-A' }); // caller is emp-A

    await expect(
      handler.execute({ conversationId: 'c1', requesterRole: 'EMPLOYEE', requesterUserId: 'user-A' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.employee.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-A' },
      select: { id: true },
    });
  });

  it('allows an EMPLOYEE to read a conversation assigned to them', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue({
      id: 'c1',
      clientId: 'u1',
      employeeId: 'emp-A',
      status: ConversationStatus.OPEN,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastMessageAt: null,
      messages: [],
    });
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-A' });

    const result = await handler.execute({
      conversationId: 'c1',
      requesterRole: 'EMPLOYEE',
      requesterUserId: 'user-A',
    });
    expect(result.id).toBe('c1');
  });

  it('does not scope a privileged role (ADMIN reads any conversation)', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue({
      id: 'c1',
      clientId: 'u1',
      employeeId: 'emp-B',
      status: ConversationStatus.OPEN,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastMessageAt: null,
      messages: [],
    });

    const result = await handler.execute({
      conversationId: 'c1',
      requesterRole: 'ADMIN',
      requesterUserId: 'user-admin',
    });
    expect(result.id).toBe('c1');
    expect(prisma.employee.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to empty user fields when the client row is missing', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue({
      id: 'c1',
      clientId: 'u-missing',
      employeeId: null,
      status: ConversationStatus.OPEN,
      createdAt: new Date('2026-05-20T10:00:00Z'),
      updatedAt: new Date('2026-05-20T11:00:00Z'),
      lastMessageAt: null,
      messages: [],
    });

    const result = await handler.execute({ conversationId: 'c1' });

    expect(result.user).toEqual({ id: 'u-missing', firstName: '', lastName: '' });
  });
});