import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ConversationStatus, MessageSenderType } from '@prisma/client';
import { RlsTransactionService } from '../../../infrastructure/database';
import { CloseConversationHandler } from './close-conversation.handler';
import { ChatAuditService } from './chat-audit.service';

describe('CloseConversationHandler', () => {
  let handler: CloseConversationHandler;
  let prisma: {
    chatConversation: { findFirst: jest.Mock; update: jest.Mock };
    employee: { findFirst: jest.Mock };
  };
  let audit: { record: jest.Mock };

  beforeEach(async () => {
    prisma = {
      chatConversation: { findFirst: jest.fn(), update: jest.fn() },
      employee: { findFirst: jest.fn() },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloseConversationHandler,
        { provide: RlsTransactionService, useValue: { withTransaction: (work: (tx: unknown) => unknown) => work(prisma) } },
        { provide: ChatAuditService, useValue: audit },
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
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('returns the existing row unchanged when already CLOSED (idempotent)', async () => {
    const row = { id: 'c1', status: ConversationStatus.CLOSED };
    prisma.chatConversation.findFirst.mockResolvedValue(row);

    const result = await handler.execute({ conversationId: 'c1' });

    expect(result).toBe(row);
    expect(prisma.chatConversation.update).not.toHaveBeenCalled();
  });

  // AUTHZ-004 / COMMS-004: EMPLOYEE callers may only close their assigned chats.
  it('forbids an EMPLOYEE from closing a conversation assigned to another counselor', async () => {
    prisma.chatConversation.findFirst.mockResolvedValue({
      id: 'c1',
      employeeId: 'emp-B',
      status: ConversationStatus.OPEN,
    });
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-A' });

    await expect(
      handler.execute({ conversationId: 'c1', requesterRole: 'EMPLOYEE', requesterUserId: 'user-A' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.chatConversation.update).not.toHaveBeenCalled();
  });

  it('updates an OPEN conversation to CLOSED with a closure timestamp', async () => {
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
      data: {
        status: ConversationStatus.CLOSED,
        closedAt: expect.any(Date),
        stateVersion: { increment: 1 },
        assistantLeaseOwner: null,
        assistantLeaseExpiresAt: null,
      },
    });
    expect(audit.record).toHaveBeenCalledWith({
      action: 'CONVERSATION_CLOSED', conversationId: 'c1',
    }, prisma);
  });
});
