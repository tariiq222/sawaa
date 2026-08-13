import { ConflictException } from '@nestjs/common';
import { assistantDispatchIdempotencyKey, assertAssistantOperationFence } from './assistant-operation-fence';

describe('assertAssistantOperationFence', () => {
  it('locks and rejects an operation when handoff or claim invalidated the assistant epoch', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      chatConversation: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    await expect(assertAssistantOperationFence(
      tx as never,
      'conversation-1',
      null,
      { stateVersion: 3, leaseOwner: 'worker-a', dispatchAttempt: 1 },
    )).rejects.toThrow(ConflictException);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.chatConversation.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'conversation-1', clientId: null, stateVersion: 3,
        assistantLeaseOwner: 'worker-a', status: 'AI_ACTIVE', isAiChat: true,
      }),
      select: { id: true },
    });
  });

  it('scopes assistant operation idempotency to the durable dispatch attempt', () => {
    const base = 'chat:message-1:prepareBooking:fingerprint';
    expect(assistantDispatchIdempotencyKey(base, {
      stateVersion: 3, leaseOwner: 'worker-a', dispatchAttempt: 1,
    })).toBe(`${base}:assistant-dispatch:1`);
    expect(assistantDispatchIdempotencyKey(base, {
      stateVersion: 3, leaseOwner: 'worker-b', dispatchAttempt: 2,
    })).toBe(`${base}:assistant-dispatch:2`);
  });
});
