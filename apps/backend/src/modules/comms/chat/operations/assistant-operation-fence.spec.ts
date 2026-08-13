import { ConflictException } from '@nestjs/common';
import { assistantDispatchIdempotencyKey, assertAssistantOperationFence } from './assistant-operation-fence';

describe('assertAssistantOperationFence', () => {
  it('locks and rejects an operation when handoff or claim invalidated the assistant epoch', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      chatConversation: { findFirst: jest.fn().mockResolvedValue(null) },
      commsChatMessage: { findFirst: jest.fn() },
    };

    await expect(assertAssistantOperationFence(
      tx as never,
      'conversation-1',
      null,
      { stateVersion: 3, leaseOwner: 'worker-a', dispatchAttempt: 1, sourceMessageId: 'message-1' },
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
      stateVersion: 3, leaseOwner: 'worker-a', dispatchAttempt: 1, sourceMessageId: 'message-1',
    })).toBe(`${base}:assistant-execution:worker-a:1`);
    expect(assistantDispatchIdempotencyKey(base, {
      stateVersion: 3, leaseOwner: 'worker-b', dispatchAttempt: 1, sourceMessageId: 'message-1',
    })).toBe(`${base}:assistant-execution:worker-b:1`);
  });

  it('rejects a stale execution when the message dispatch has advanced under the same conversation epoch', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      chatConversation: { findFirst: jest.fn().mockResolvedValue({ id: 'conversation-1' }) },
      commsChatMessage: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    await expect(assertAssistantOperationFence(
      tx as never,
      'conversation-1',
      null,
      { stateVersion: 3, leaseOwner: 'worker-a', dispatchAttempt: 1, sourceMessageId: 'message-1' },
    )).rejects.toThrow(ConflictException);

    expect(tx.commsChatMessage.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'message-1',
        conversationId: 'conversation-1',
        metadata: { path: ['dispatchAttempt'], equals: 1 },
      },
      select: { id: true },
    });
  });
});
