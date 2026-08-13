import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ChatMessageKind, ChatOperationStatus, ChatOperationType } from '@prisma/client';
import { DeclineOperationHandler } from './decline-operation.handler';

function harness() {
  let operation: any = {
    id: 'operation-1', conversationId: 'conversation-1', clientId: 'client-1',
    type: ChatOperationType.CREATE_BOOKING, status: ChatOperationStatus.AWAITING_CONFIRMATION,
    payload: {}, summary: {}, idempotencyKey: 'key', requiredConfirmations: 1,
    confirmationCount: 0, version: 0,
    expiresAt: new Date('2026-08-13T09:15:00.000Z'), resultMessageId: null,
  };
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'operation-1' }]),
    $executeRaw: jest.fn().mockResolvedValue(undefined),
    chatOperation: {
      findUnique: jest.fn().mockImplementation(async () => ({ ...operation })),
      updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
        if (where.version !== operation.version || where.status !== operation.status) return { count: 0 };
        operation = { ...operation, ...data, version: operation.version + (data.version?.increment ?? 0) };
        return { count: 1 };
      }),
      update: jest.fn().mockImplementation(async ({ data }) => {
        operation = { ...operation, ...data };
        return { ...operation };
      }),
    },
    chatConversation: {
      findFirst: jest.fn().mockResolvedValue({ id: 'conversation-1' }),
      update: jest.fn().mockResolvedValue({ id: 'conversation-1' }),
    },
    commsChatMessage: { create: jest.fn().mockResolvedValue({ id: 'message-1' }) },
  };
  return {
    handler: new DeclineOperationHandler({ withTransaction: (fn: (db: typeof tx) => unknown) => fn(tx) } as never),
    tx,
    setOperation: (value: Record<string, unknown>) => { operation = { ...operation, ...value }; },
  };
}

describe('DeclineOperationHandler', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-08-13T09:00:00.000Z')));
  afterEach(() => jest.useRealTimers());

  it('declines with CAS and writes one public-safe result message', async () => {
    const { handler, tx } = harness();
    const result = await handler.execute({ operationId: 'operation-1', clientId: 'client-1', expectedVersion: 0 });

    expect(result).toMatchObject({ status: ChatOperationStatus.DECLINED, version: 1, resultMessageId: 'message-1' });
    expect(tx.commsChatMessage.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      kind: ChatMessageKind.OPERATION_RESULT,
      metadata: {
        operationId: 'operation-1', type: ChatOperationType.CREATE_BOOKING,
        status: ChatOperationStatus.DECLINED,
      },
    }) });
  });

  it('returns the same declined result on a repeated click without another message', async () => {
    const { handler, tx, setOperation } = harness();
    setOperation({ status: ChatOperationStatus.DECLINED, version: 1, resultMessageId: 'message-1' });
    const result = await handler.execute({ operationId: 'operation-1', clientId: 'client-1', expectedVersion: 0 });
    expect(result.resultMessageId).toBe('message-1');
    expect(tx.commsChatMessage.create).not.toHaveBeenCalled();
  });

  it('enforces ownership and optimistic version', async () => {
    const { handler } = harness();
    await expect(handler.execute({ operationId: 'operation-1', clientId: 'other', expectedVersion: 0 }))
      .rejects.toThrow(ForbiddenException);
    await expect(handler.execute({ operationId: 'operation-1', clientId: 'client-1', expectedVersion: 9 }))
      .rejects.toThrow(ConflictException);
  });
});
