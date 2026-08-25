import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { ChatAccessService } from './chat-access.service';
import { GuestChatTokenService } from './guest-chat-token.service';

const guestConversation = {
  id: '00000000-0000-4000-a000-000000000001',
  clientId: null,
  guestTokenHash: '',
  guestName: 'Guest A',
  guestPhone: '+966500000001',
  isAiChat: true,
  status: 'AI_ACTIVE',
  language: 'ar',
};

describe('ChatAccessService', () => {
  const tokenService = new GuestChatTokenService({
    getOrThrow: jest.fn().mockReturnValue('test-only-chat-guest-token-secret'),
  } as unknown as ConfigService);
  let prisma: {
    chatConversation: { findFirst: jest.Mock; updateMany: jest.Mock; findUnique: jest.Mock };
    outboxEvent: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let rlsTransaction: { withTransaction: jest.Mock };
  let service: ChatAccessService;
  let audit: { record: jest.Mock };

  beforeEach(() => {
    prisma = {
      chatConversation: { findFirst: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn() },
      outboxEvent: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    rlsTransaction = { withTransaction: jest.fn() };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new ChatAccessService(
      prisma as unknown as PrismaService,
      tokenService,
      rlsTransaction as unknown as RlsTransactionService,
      audit as never,
    );
  });

  it('does not let guest A read guest B conversation when only the conversation ID is known', async () => {
    prisma.chatConversation.findFirst.mockImplementation(async ({ where }) => (
      where.guestTokenHash === tokenService.hash('guest-a') ? { ...guestConversation, guestTokenHash: where.guestTokenHash } : null
    ));

    await expect(service.assertGuestAccess(guestConversation.id, 'guest-b')).rejects.toThrow(NotFoundException);
    await expect(service.assertGuestAccess(guestConversation.id, 'guest-a')).resolves.toMatchObject({ id: guestConversation.id });
  });

  it('does not let client A read a conversation belonging to client B', async () => {
    prisma.chatConversation.findFirst.mockImplementation(async ({ where }) => (
      where.clientId === 'client-b' ? { ...guestConversation, clientId: 'client-b', guestTokenHash: null } : null
    ));

    await expect(service.assertClientAccess(guestConversation.id, 'client-a')).rejects.toThrow(NotFoundException);
    await expect(service.assertClientAccess(guestConversation.id, 'client-b')).resolves.toMatchObject({ clientId: 'client-b' });
  });

  it('returns the current guest conversation only for its guest cookie and excludes newer closed rows', async () => {
    const conversations = [
      { ...guestConversation, id: 'guest-closed-newer', status: 'CLOSED' },
      { ...guestConversation, id: 'guest-active', status: 'AI_ACTIVE' },
    ];
    prisma.chatConversation.findFirst.mockImplementation(async ({ where, orderBy }) => (
      where.guestTokenHash === tokenService.hash('guest-a') &&
      where.status?.not === 'CLOSED' &&
      JSON.stringify(orderBy) === JSON.stringify([{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }])
        ? conversations.find((conversation) => conversation.status !== 'CLOSED')
        : null
    ));

    await expect(service.getCurrentForGuest('guest-b')).rejects.toThrow(NotFoundException);
    await expect(service.getCurrentForGuest('guest-a')).resolves.toMatchObject({ id: 'guest-active', status: 'AI_ACTIVE' });
  });

  it('returns the current client conversation only from active rows and breaks timestamp ties by ID', async () => {
    const timestampTie = [
      { ...guestConversation, id: 'client-a', clientId: 'client-a', status: 'AI_ACTIVE' },
      { ...guestConversation, id: 'client-z', clientId: 'client-a', status: 'AI_ACTIVE' },
    ];
    prisma.chatConversation.findFirst.mockImplementation(async ({ where, orderBy }) => (
      where.clientId === 'client-a' &&
      where.status?.not === 'CLOSED' &&
      JSON.stringify(orderBy) === JSON.stringify([{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }])
        ? timestampTie.find((conversation) => conversation.id === 'client-z')
        : null
    ));

    await expect(service.getCurrentForClient('client-a')).resolves.toMatchObject({ id: 'client-z', status: 'AI_ACTIVE' });
  });

  it('claims a guest conversation atomically, binds the authenticated client, and clears guest identity material', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const findUnique = jest.fn().mockResolvedValue({
      ...guestConversation,
      clientId: 'client-a',
      guestTokenHash: null,
      guestName: null,
      guestPhone: null,
    });
    const outboxCreate = jest.fn().mockResolvedValue({});
    const lock = jest.fn().mockResolvedValue(1);
    rlsTransaction.withTransaction.mockImplementation(async (work) => work({
      $executeRaw: lock,
      chatConversation: { updateMany, findUnique },
      outboxEvent: { create: outboxCreate },
    }));

    const claimed = await service.claimGuestConversation({
      conversationId: guestConversation.id,
      guestToken: 'guest-a',
      clientId: 'client-a',
    });

    expect(claimed).toMatchObject({ id: guestConversation.id, clientId: 'client-a', guestTokenHash: null });
    expect(rlsTransaction.withTransaction).toHaveBeenCalledTimes(1);
    expect(lock).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: guestConversation.id,
        clientId: null,
        guestTokenHash: tokenService.hash('guest-a'),
      },
      data: {
        clientId: 'client-a',
        guestTokenHash: null,
        guestName: null,
        guestPhone: null,
        stateVersion: { increment: 1 },
        assistantLeaseOwner: null,
        assistantLeaseExpiresAt: null,
      },
    });
    expect(outboxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: expect.any(String),
        aggregateId: guestConversation.id,
        eventType: 'comms.chat.operations.resume_requested',
        payload: expect.objectContaining({
          eventId: expect.any(String),
          payload: {
            conversationId: guestConversation.id,
            clientId: 'client-a',
          },
        }),
      }),
    });
    expect(audit.record).toHaveBeenCalledWith({
      action: 'GUEST_CLAIMED',
      conversationId: guestConversation.id,
      clientId: 'client-a',
    }, expect.any(Object));
  });

  it('refuses a claim when the guest cookie no longer owns an unclaimed conversation', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    rlsTransaction.withTransaction.mockImplementation(async (work) => work({
      $executeRaw: jest.fn().mockResolvedValue(1),
      chatConversation: { updateMany, findUnique: jest.fn() },
    }));

    await expect(service.claimGuestConversation({
      conversationId: guestConversation.id,
      guestToken: 'guest-a',
      clientId: 'client-a',
    })).rejects.toThrow(ForbiddenException);
    expect(audit.record).not.toHaveBeenCalled();
  });
});
