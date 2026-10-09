import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createOrGetPreparedOperation } from './create-or-get-prepared-operation';

const data = {
  conversationId: 'conversation-1', clientId: null, type: 'CREATE_BOOKING' as const,
  status: 'AWAITING_AUTH' as const, payload: { intent: 'CREATE_BOOKING' },
  summary: { action: 'LOGIN_REQUIRED' }, idempotencyKey: 'key-1',
  requiredConfirmations: 0, expiresAt: new Date('2026-08-13T09:15:00Z'),
};

const assistantFence = { stateVersion: 3, leaseOwner: 'worker-a', dispatchAttempt: 1, sourceMessageId: 'message-1' };

function harness() {
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    chatConversation: { findFirst: jest.fn().mockResolvedValue({ id: 'conversation-1' }) },
    commsChatMessage: { findFirst: jest.fn().mockResolvedValue({ id: 'message-1' }) },
    chatOperation: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'created' }) },
  };
  const rls = { withTransaction: jest.fn((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)) };
  return { prisma, rls };
}

describe('createOrGetPreparedOperation', () => {
  it('returns existing operation without creating a duplicate', async () => {
    const { prisma, rls } = harness();
    prisma.chatOperation.findUnique.mockResolvedValueOnce({ id: 'existing' });
    await expect(createOrGetPreparedOperation(prisma as never, rls as never, data)).resolves.toEqual({ id: 'existing' });
    expect(prisma.chatOperation.create).not.toHaveBeenCalled();
  });

  it('enforces a valid fence before lookup and persists JSON fields without the fence', async () => {
    const { prisma, rls } = harness();
    await createOrGetPreparedOperation(prisma as never, rls as never, { ...data, assistantFence });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.chatConversation.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: data.conversationId, clientId: data.clientId, stateVersion: 3, assistantLeaseOwner: 'worker-a' }),
      select: { id: true },
    });
    expect(prisma.commsChatMessage.findFirst).toHaveBeenCalledWith({
      where: { id: 'message-1', conversationId: data.conversationId, metadata: { path: ['dispatchAttempt'], equals: 1 } },
      select: { id: true },
    });
    expect(prisma.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(prisma.chatOperation.findUnique.mock.invocationCallOrder[0]);
    expect(prisma.commsChatMessage.findFirst.mock.invocationCallOrder[0]).toBeLessThan(prisma.chatOperation.findUnique.mock.invocationCallOrder[0]);
    expect(prisma.chatOperation.create).toHaveBeenCalledWith({ data });
  });

  it('rejects a stale fence before returning an existing operation', async () => {
    const { prisma, rls } = harness();
    prisma.chatOperation.findUnique.mockResolvedValue({ id: 'existing' });
    prisma.chatConversation.findFirst.mockResolvedValue(null);
    await expect(createOrGetPreparedOperation(prisma as never, rls as never, { ...data, assistantFence })).rejects.toThrow(ConflictException);
    expect(prisma.chatOperation.findUnique).not.toHaveBeenCalled();
    expect(prisma.chatOperation.create).not.toHaveBeenCalled();
  });

  it('returns the winner of an idempotency-key race after P2002', async () => {
    const { prisma, rls } = harness();
    const uniqueError = new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '7' });
    prisma.chatOperation.create.mockRejectedValueOnce(uniqueError);
    prisma.chatOperation.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'winner' });
    await expect(createOrGetPreparedOperation(prisma as never, rls as never, data)).resolves.toEqual({ id: 'winner' });
    expect(prisma.chatOperation.findUnique).toHaveBeenCalledTimes(2);
  });

  it('rethrows P2002 when the winner is not visible', async () => {
    const { prisma, rls } = harness();
    const uniqueError = new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: '7' });
    prisma.chatOperation.create.mockRejectedValueOnce(uniqueError);
    await expect(createOrGetPreparedOperation(prisma as never, rls as never, data)).rejects.toBe(uniqueError);
  });

  it('does not swallow unrelated errors', async () => {
    const { prisma, rls } = harness();
    const error = new Error('database unavailable');
    prisma.chatOperation.create.mockRejectedValueOnce(error);
    await expect(createOrGetPreparedOperation(prisma as never, rls as never, data)).rejects.toBe(error);
    expect(prisma.chatOperation.findUnique).toHaveBeenCalledTimes(1);
  });
});
