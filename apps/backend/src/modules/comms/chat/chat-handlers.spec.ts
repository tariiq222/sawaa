import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConversationStatus, MessageSenderType } from '@prisma/client';
import { GetConversationHandler } from './get-conversation.handler';
import { CloseConversationHandler } from './close-conversation.handler';
import { SendStaffMessageHandler } from './send-staff-message.handler';

const buildPrisma = () => ({
  chatConversation: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  commsChatMessage: {
    create: jest.fn(),
  },
  client: {
    findFirst: jest.fn().mockResolvedValue(null),
  },
});

const conversationId = 'conv-1';

describe('GetConversationHandler', () => {
  let handler: GetConversationHandler;
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(() => {
    prisma = buildPrisma();
    handler = new GetConversationHandler(prisma as never);
  });

  it('returns conversation with reshaped messages', async () => {
    const conv = {
      id: conversationId,
      clientId: 'client-1',
      employeeId: null,
      status: ConversationStatus.OPEN,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
      lastMessageAt: null,
      messages: [
        { id: 'msg-1', conversationId, senderType: MessageSenderType.CLIENT, body: 'hi', createdAt: new Date('2026-01-01T00:01:00Z') },
      ],
    };
    prisma.chatConversation.findFirst.mockResolvedValue(conv);
    prisma.client.findFirst.mockResolvedValue({ id: 'client-1', firstName: 'Sara', lastName: 'A' });

    const result = await handler.execute({ conversationId });

    expect(result.id).toBe(conversationId);
    expect(result.handedOff).toBe(false);
    expect(result.endedAt).toBeNull();
    expect(result.user).toEqual({ id: 'client-1', firstName: 'Sara', lastName: 'A' });
    expect(result.messages[0]).toMatchObject({ id: 'msg-1', role: 'user', content: 'hi' });
    expect(prisma.chatConversation.findFirst).toHaveBeenCalledWith({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  });

  it('throws NotFoundException when not found', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue(null);

    await expect(handler.execute({ conversationId })).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('CloseConversationHandler', () => {
  let handler: CloseConversationHandler;
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(() => {
    prisma = buildPrisma();
    handler = new CloseConversationHandler(prisma as never);
  });

  it('closes an open conversation', async () => {
    const conv = { id: conversationId, status: ConversationStatus.OPEN };
    const updated = { ...conv, status: ConversationStatus.CLOSED };
    prisma.chatConversation.findFirst.mockResolvedValue(conv);
    prisma.chatConversation.update.mockResolvedValue(updated);

    const result = await handler.execute({ conversationId });

    expect(result).toEqual(updated);
    expect(prisma.chatConversation.update).toHaveBeenCalledWith({
      where: { id: conversationId },
      data: { status: ConversationStatus.CLOSED },
    });
  });

  it('returns existing when already closed (idempotent)', async () => {
    const conv = { id: conversationId, status: ConversationStatus.CLOSED };
    prisma.chatConversation.findFirst.mockResolvedValue(conv);

    const result = await handler.execute({ conversationId });

    expect(result).toEqual(conv);
    expect(prisma.chatConversation.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when not found', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue(null);

    await expect(handler.execute({ conversationId })).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('SendStaffMessageHandler', () => {
  let handler: SendStaffMessageHandler;
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(() => {
    prisma = buildPrisma();
    handler = new SendStaffMessageHandler(prisma as never);
  });

  it('creates a staff message tagged with the conversation organizationId and updates lastMessageAt', async () => {
    const conv = { id: conversationId, status: ConversationStatus.OPEN, organizationId: 'org-A' };
    const message = { id: 'msg-1', body: 'Hello', senderType: MessageSenderType.EMPLOYEE };
    prisma.chatConversation.findFirst.mockResolvedValue(conv);
    prisma.commsChatMessage.create.mockResolvedValue(message);
    prisma.chatConversation.update.mockResolvedValue({ ...conv });

    const result = await handler.execute({
      conversationId,
      staffId: 'staff-1',
      body: 'Hello',
    });

    expect(result).toEqual(message);
    expect(prisma.commsChatMessage.create).toHaveBeenCalledWith({
      data: {
        // org scoping moved to RLS / removed in single-tenant migration
        conversationId,
        senderType: MessageSenderType.EMPLOYEE,
        senderId: 'staff-1',
        body: 'Hello',
      },
    });
    expect(prisma.chatConversation.update).toHaveBeenCalledWith({
      where: { id: conversationId },
      data: { lastMessageAt: expect.any(Date) },
    });
  });

  it('throws NotFoundException when conversation not found', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute({ conversationId, staffId: 'staff-1', body: 'Hello' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when conversation is closed', async () => {
    const conv = { id: conversationId, status: ConversationStatus.CLOSED };
    prisma.chatConversation.findFirst.mockResolvedValue(conv);

    await expect(
      handler.execute({ conversationId, staffId: 'staff-1', body: 'Hello' }),
    ).rejects.toThrow(BadRequestException);
  });
});
