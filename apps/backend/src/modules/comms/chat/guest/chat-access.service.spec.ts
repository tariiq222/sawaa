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
    $transaction: jest.Mock;
  };
  let rlsTransaction: { withTransaction: jest.Mock };
  let service: ChatAccessService;

  beforeEach(() => {
    prisma = {
      chatConversation: { findFirst: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    rlsTransaction = { withTransaction: jest.fn() };
    service = new ChatAccessService(
      prisma as unknown as PrismaService,
      tokenService,
      rlsTransaction as unknown as RlsTransactionService,
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

  it('returns the current guest conversation only for its guest cookie', async () => {
    prisma.chatConversation.findFirst.mockImplementation(async ({ where }) => (
      where.guestTokenHash === tokenService.hash('guest-a') ? { ...guestConversation, guestTokenHash: where.guestTokenHash } : null
    ));

    await expect(service.getCurrentForGuest('guest-b')).rejects.toThrow(NotFoundException);
    await expect(service.getCurrentForGuest('guest-a')).resolves.toMatchObject({ id: guestConversation.id });
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
    rlsTransaction.withTransaction.mockImplementation(async (work) => work({ chatConversation: { updateMany, findUnique } }));

    const claimed = await service.claimGuestConversation({
      conversationId: guestConversation.id,
      guestToken: 'guest-a',
      clientId: 'client-a',
    });

    expect(claimed).toMatchObject({ id: guestConversation.id, clientId: 'client-a', guestTokenHash: null });
    expect(rlsTransaction.withTransaction).toHaveBeenCalledTimes(1);
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
      },
    });
  });

  it('refuses a claim when the guest cookie no longer owns an unclaimed conversation', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    rlsTransaction.withTransaction.mockImplementation(async (work) => work({ chatConversation: { updateMany, findUnique: jest.fn() } }));

    await expect(service.claimGuestConversation({
      conversationId: guestConversation.id,
      guestToken: 'guest-a',
      clientId: 'client-a',
    })).rejects.toThrow(ForbiddenException);
  });
});
