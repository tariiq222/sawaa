import { ConflictException } from '@nestjs/common';
import { ChatMessageKind, ConversationStatus, MessageSenderType } from '@prisma/client';
import { RlsTransactionService } from '../../../../infrastructure/database';
import { ChatAccessService } from '../guest/chat-access.service';
import { RequestHandoffHandler } from './request-handoff.handler';

const conversation = {
  id: '00000000-0000-4000-a000-000000000001',
  clientId: null,
  guestTokenHash: 'guest-hash',
  status: ConversationStatus.AI_ACTIVE,
  guestName: null,
  guestPhone: null,
};

describe('RequestHandoffHandler', () => {
  let prisma: { $executeRaw: jest.Mock; service: { findFirst: jest.Mock }; employee: { findFirst: jest.Mock }; employeeService: { findFirst: jest.Mock }; commsChatMessage: { create: jest.Mock }; chatConversation: { updateMany: jest.Mock; findFirst: jest.Mock; findUnique: jest.Mock } };
  let access: { assertGuestAccess: jest.Mock; assertClientAccess: jest.Mock };
  let handler: RequestHandoffHandler;
  let audit: { record: jest.Mock };
  let rlsTransaction: { withTransaction: jest.Mock };

  beforeEach(() => {
    prisma = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      service: { findFirst: jest.fn().mockResolvedValue({ id: 'service' }) },
      employee: { findFirst: jest.fn().mockResolvedValue({ id: 'employee' }) },
      employeeService: { findFirst: jest.fn().mockResolvedValue({ id: 'employee-service' }) },
      commsChatMessage: { create: jest.fn().mockResolvedValue({ id: 'handoff-message' }) },
      chatConversation: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockImplementation(({ select }) => select
          ? { ...conversation, status: ConversationStatus.AI_ACTIVE, customerContext: null }
          : { ...conversation, status: ConversationStatus.WAITING_FOR_STAFF, guestName: 'سارة', guestPhone: '+966501234567' }),
        findUnique: jest.fn().mockResolvedValue({
          ...conversation,
          status: ConversationStatus.WAITING_FOR_STAFF,
          guestName: 'سارة',
          guestPhone: '+966501234567',
        }),
      },
    };
    access = {
      assertGuestAccess: jest.fn().mockResolvedValue(conversation),
      assertClientAccess: jest.fn().mockResolvedValue({ ...conversation, clientId: 'client-a' }),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    rlsTransaction = { withTransaction: jest.fn().mockImplementation((work) => work(prisma)) };
    handler = new RequestHandoffHandler(
      rlsTransaction as unknown as RlsTransactionService,
      access as unknown as ChatAccessService,
      audit as never,
    );
  });

  it('atomically moves an owned guest AI conversation to waiting and stores only trimmed contact fields', async () => {
    await handler.execute({
      audience: 'guest',
      conversationId: conversation.id,
      guestToken: 'guest-token',
      guestName: '  سارة  ',
      guestPhone: '+966501234567',
    });

    expect(access.assertGuestAccess).toHaveBeenCalledWith(conversation.id, 'guest-token');
    expect(prisma.chatConversation.updateMany).toHaveBeenCalledWith({
      where: {
        id: conversation.id,
        status: ConversationStatus.AI_ACTIVE,
        clientId: null,
        guestTokenHash: 'guest-hash',
      },
      data: expect.objectContaining({
        status: ConversationStatus.WAITING_FOR_STAFF,
        handoffRequestedAt: expect.any(Date),
        guestName: 'سارة',
        guestPhone: '+966501234567',
        stateVersion: { increment: 1 },
        assistantLeaseOwner: null,
        assistantLeaseExpiresAt: null,
      }),
    });
    expect(JSON.stringify(prisma.chatConversation.updateMany.mock.calls)).not.toMatch(/reason|risk|tag/i);
    expect(audit.record).toHaveBeenCalledWith({
      action: 'HANDOFF_REQUESTED', conversationId: conversation.id,
    }, prisma);
    expect(prisma.commsChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      senderType: MessageSenderType.SYSTEM, kind: ChatMessageKind.SYSTEM_EVENT,
      body: 'تم استلام طلبك وتحويله لفريق الاستقبال، وبيتواصلون معك خلال أوقات عمل المركز.',
      clientMessageId: `handoff:${conversation.id}:state:0`,
    }) }));
    expect(rlsTransaction.withTransaction).toHaveBeenCalledTimes(1);
  });

  it('derives authenticated client identity and never writes guest contact fields', async () => {
    await handler.execute({ audience: 'client', conversationId: conversation.id, clientId: 'client-a' });

    expect(access.assertClientAccess).toHaveBeenCalledWith(conversation.id, 'client-a');
    expect(prisma.chatConversation.updateMany).toHaveBeenCalledWith({
      where: { id: conversation.id, status: ConversationStatus.AI_ACTIVE, clientId: 'client-a' },
      data: expect.objectContaining({
        status: ConversationStatus.WAITING_FOR_STAFF,
        handoffRequestedAt: expect.any(Date),
        stateVersion: { increment: 1 },
        assistantLeaseOwner: null,
        assistantLeaseExpiresAt: null,
      }),
    });
  });

  it('stores a validated handoff summary in the same state/CAS mutation and audit transaction', async () => {
    await handler.execute({
      audience: 'guest', conversationId: conversation.id, guestToken: 'guest-token', guestName: 'سارة', guestPhone: '+966501234567',
      handoffSummary: {
        category: 'COMPLAINT', requestSummary: 'تأخر الرد', desiredOutcome: 'متابعة من الاستقبال',
        serviceId: '00000000-0000-4000-a000-000000000002', acceptableAlternatives: ['اتصال من المركز'],
      },
    });
    expect(prisma.chatConversation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        customerContext: { handoffSummary: {
          category: 'COMPLAINT', requestSummary: 'تأخر الرد', desiredOutcome: 'متابعة من الاستقبال',
          serviceId: '00000000-0000-4000-a000-000000000002', acceptableAlternatives: ['اتصال من المركز'],
        } },
        customerContextVersion: { increment: 1 },
      }),
    }));
    expect(audit.record).toHaveBeenCalledWith({ action: 'HANDOFF_REQUESTED', conversationId: conversation.id }, prisma);
  });

  it('does not increment customer context version when no summary is supplied', async () => {
    await handler.execute({ audience: 'guest', conversationId: conversation.id, guestToken: 'guest-token', guestName: 'سارة', guestPhone: '+966501234567' });
    expect(prisma.chatConversation.updateMany.mock.calls[0][0].data.customerContextVersion).toBeUndefined();
  });

  it('accepts a stale assistant retry only as the current owned waiting state', async () => {
    const assistant = {
      audience: 'assistant' as const, conversationId: conversation.id, clientId: null, guestTokenHash: 'guest-hash',
      guestName: 'سارة', guestPhone: '+966501234567', stateVersion: 0, customerContextVersion: 0,
      status: ConversationStatus.AI_ACTIVE, customerContext: null,
      handoffSummary: { category: 'USER_REQUESTED', requestSummary: 'أحتاج مساعدة', desiredOutcome: 'متابعة' },
    };
    prisma.chatConversation.findFirst
      .mockImplementationOnce(() => null)
      .mockImplementationOnce(() => ({ ...conversation, status: ConversationStatus.WAITING_FOR_STAFF }));

    await expect(handler.execute(assistant)).resolves.toEqual(expect.objectContaining({ status: ConversationStatus.WAITING_FOR_STAFF }));
    expect(prisma.chatConversation.updateMany).not.toHaveBeenCalled();
    expect(prisma.commsChatMessage.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('uses a new deterministic confirmation key after release and a later re-handoff', async () => {
    const first = await handler.execute({ audience: 'guest', conversationId: conversation.id, guestToken: 'guest-token', guestName: 'سارة', guestPhone: '+966501234567' });
    expect(first.status).toBe(ConversationStatus.WAITING_FOR_STAFF);
    access.assertGuestAccess.mockResolvedValueOnce({ ...conversation, stateVersion: 2, customerContextVersion: 0 });
    prisma.chatConversation.findFirst
      .mockImplementationOnce(({ select }) => select ? { ...conversation, status: ConversationStatus.AI_ACTIVE, customerContext: null, stateVersion: 2, customerContextVersion: 0 } : { ...conversation, status: ConversationStatus.WAITING_FOR_STAFF });
    await handler.execute({ audience: 'guest', conversationId: conversation.id, guestToken: 'guest-token', guestName: 'سارة', guestPhone: '+966501234567' });
    expect(prisma.commsChatMessage.create.mock.calls.map((call) => call[0].data.clientMessageId)).toEqual([
      `handoff:${conversation.id}:state:0`, `handoff:${conversation.id}:state:2`,
    ]);
  });

  it('rejects clinical, risk, staff, provider, and unknown summary fields before opening a transaction', async () => {
    await expect(handler.execute({
      audience: 'guest', conversationId: conversation.id, guestToken: 'guest-token', guestName: 'سارة', guestPhone: '+966501234567',
      handoffSummary: { category: 'OTHER', requestSummary: 'طلب', desiredOutcome: 'حل', riskTag: 'high' },
    })).rejects.toThrow('Handoff summary is invalid');
    expect(rlsTransaction.withTransaction).not.toHaveBeenCalled();
  });

  it.each([
    ['missing service', 'service', 'service is no longer available'],
    ['inactive practitioner', 'employee', 'practitioner is no longer available'],
    ['missing practitioner service link', 'employeeService', 'practitioner does not offer this service'],
  ])('rejects a stale %s before any handoff mutation', async (_label, resource, message) => {
    (prisma[resource as 'service' | 'employee' | 'employeeService'].findFirst as jest.Mock).mockResolvedValueOnce(null);
    await expect(handler.execute({
      audience: 'guest', conversationId: conversation.id, guestToken: 'guest-token', guestName: 'سارة', guestPhone: '+966501234567',
      handoffSummary: {
        category: 'UNAVAILABLE_APPOINTMENT', requestSummary: 'ما لقيت الموعد', desiredOutcome: 'موعد بديل',
        serviceId: '00000000-0000-4000-a000-000000000002', practitionerId: '00000000-0000-4000-a000-000000000003',
      },
    })).rejects.toThrow(message);
    expect(prisma.chatConversation.updateMany).not.toHaveBeenCalled();
    expect(prisma.commsChatMessage.create).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('revalidates active public service, practitioner, and their active offer inside the locked transaction', async () => {
    await handler.execute({
      audience: 'guest', conversationId: conversation.id, guestToken: 'guest-token', guestName: 'سارة', guestPhone: '+966501234567',
      handoffSummary: {
        category: 'USER_REQUESTED', requestSummary: 'أحتاج موعد', desiredOutcome: 'متابعة',
        serviceId: '00000000-0000-4000-a000-000000000002', practitionerId: '00000000-0000-4000-a000-000000000003',
      },
    });
    expect(prisma.service.findFirst).toHaveBeenCalledWith({ where: { id: '00000000-0000-4000-a000-000000000002', isActive: true }, select: { id: true } });
    expect(prisma.employee.findFirst).toHaveBeenCalledWith({ where: { id: '00000000-0000-4000-a000-000000000003', isActive: true, isPublic: true }, select: { id: true } });
    expect(prisma.employeeService.findFirst).toHaveBeenCalledWith({ where: { employeeId: '00000000-0000-4000-a000-000000000003', serviceId: '00000000-0000-4000-a000-000000000002', isActive: true }, select: { id: true } });
    expect(prisma.chatConversation.updateMany).toHaveBeenCalled();
  });

  it('does not let a stale guest write contact after the conversation is claimed', async () => {
    prisma.chatConversation.updateMany.mockResolvedValue({ count: 0 });
    prisma.chatConversation.findFirst.mockResolvedValue(null);
    prisma.chatConversation.findUnique.mockResolvedValue({
      ...conversation, clientId: 'client-a', status: ConversationStatus.WAITING_FOR_STAFF,
    });

    await expect(handler.execute({
      audience: 'guest', conversationId: conversation.id, guestToken: 'guest-token', guestName: 'attacker', guestPhone: '+966501234567',
    })).rejects.toThrow(ConflictException);
    expect(prisma.chatConversation.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: conversation.id, clientId: null, guestTokenHash: 'guest-hash' }),
    }));
  });

  it('does not return guest data when claiming wins immediately after the handoff CAS', async () => {
    prisma.chatConversation.updateMany.mockResolvedValue({ count: 1 });
    prisma.chatConversation.findFirst.mockResolvedValue(null);
    prisma.chatConversation.findUnique.mockResolvedValue({
      ...conversation,
      clientId: 'client-a',
      guestTokenHash: null,
      guestName: null,
      guestPhone: null,
      status: ConversationStatus.WAITING_FOR_STAFF,
    });

    await expect(handler.execute({
      audience: 'guest', conversationId: conversation.id, guestToken: 'guest-token', guestName: 'سارة', guestPhone: '+966501234567',
    })).rejects.toThrow(ConflictException);
  });

  it('returns the winning waiting state idempotently after a duplicate race', async () => {
    prisma.chatConversation.updateMany.mockResolvedValue({ count: 0 });

    await expect(handler.execute({
      audience: 'guest', conversationId: conversation.id, guestToken: 'guest-token', guestName: 'سارة', guestPhone: '+966501234567',
    })).resolves.toEqual(expect.objectContaining({ status: ConversationStatus.WAITING_FOR_STAFF }));
    expect(audit.record).not.toHaveBeenCalled();
    expect(prisma.commsChatMessage.create).not.toHaveBeenCalled();
  });

  it('rolls back an unaudited handoff so a retry can write the one semantic event', async () => {
    audit.record.mockRejectedValueOnce(new Error('audit write failed'));
    prisma.commsChatMessage.create.mockResolvedValueOnce({ id: 'handoff-message' });

    await expect(handler.execute({
      audience: 'guest', conversationId: conversation.id, guestToken: 'guest-token', guestName: 'سارة', guestPhone: '+966501234567',
    })).rejects.toThrow('audit write failed');

    await expect(handler.execute({
      audience: 'guest', conversationId: conversation.id, guestToken: 'guest-token', guestName: 'سارة', guestPhone: '+966501234567',
    })).resolves.toEqual(expect.objectContaining({ status: ConversationStatus.WAITING_FOR_STAFF }));

    expect(rlsTransaction.withTransaction).toHaveBeenCalledTimes(2);
    expect(audit.record).toHaveBeenCalledTimes(2);
    expect(prisma.commsChatMessage.create).toHaveBeenCalledTimes(2);
  });

  it.each([
    ConversationStatus.STAFF_ACTIVE,
    ConversationStatus.CLOSED,
    ConversationStatus.OPEN,
  ])('rejects handoff from %s without writing', async (status) => {
    access.assertGuestAccess.mockResolvedValue({ ...conversation, status });

    await expect(handler.execute({
      audience: 'guest', conversationId: conversation.id, guestToken: 'guest-token', guestName: 'سارة', guestPhone: '+966501234567',
    })).rejects.toThrow(ConflictException);
    expect(prisma.chatConversation.updateMany).not.toHaveBeenCalled();
  });
});
