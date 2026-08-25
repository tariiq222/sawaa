import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ChatOperationStatus, ChatOperationType } from '@prisma/client';
import { AcknowledgeExistingBookingHandler } from './acknowledge-existing-booking.handler';
import { ChatAuditService } from '../chat-audit.service';

const baseOperation: any = {
  id: 'operation-1', conversationId: 'conversation-1', clientId: 'client-1',
  type: ChatOperationType.CREATE_BOOKING,
  status: ChatOperationStatus.AWAITING_EXISTING_BOOKING_ACK,
  payload: {}, summary: {}, idempotencyKey: 'key-1', requiredConfirmations: 2,
  confirmationCount: 0, version: 0,
  expiresAt: new Date('2026-08-13T09:15:00.000Z'),
  confirmedAt: null, executedAt: null, bookingId: null, resultMessageId: null,
  errorCode: null, createdAt: new Date(), updatedAt: new Date(),
};

function harness(overrides: Record<string, unknown> = {}, conversationOwned = true) {
  let operation = { ...baseOperation, ...overrides };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: operation.id }]),
    chatOperation: {
      findUnique: jest.fn().mockImplementation(async () => ({ ...operation })),
      updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
        if (where.id !== operation.id || where.version !== operation.version || where.status !== operation.status) {
          return { count: 0 };
        }
        operation = {
          ...operation,
          ...data,
          confirmationCount: data.confirmationCount?.increment
            ? operation.confirmationCount + data.confirmationCount.increment
            : operation.confirmationCount,
          version: data.version?.increment ? operation.version + data.version.increment : operation.version,
        };
        return { count: 1 };
      }),
    },
    chatConversation: {
      findFirst: jest.fn().mockResolvedValue(conversationOwned ? { id: operation.conversationId } : null),
    },
  };
  const rls = { withTransaction: jest.fn((fn) => fn(tx)) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  return {
    handler: new AcknowledgeExistingBookingHandler(rls as never, audit as unknown as ChatAuditService),
    tx,
    audit,
    getOperation: () => operation,
  };
}

describe('AcknowledgeExistingBookingHandler', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-08-13T09:00:00.000Z')));
  afterEach(() => jest.useRealTimers());

  it('uses a row lock and CAS to record the first confirmation separately', async () => {
    const { handler, tx, audit } = harness();

    const result = await handler.execute({ operationId: 'operation-1', clientId: 'client-1', expectedVersion: 0 });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.chatOperation.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'operation-1', version: 0,
        status: ChatOperationStatus.AWAITING_EXISTING_BOOKING_ACK,
      },
      data: {
        status: ChatOperationStatus.AWAITING_CONFIRMATION,
        confirmationCount: { increment: 1 },
        version: { increment: 1 },
      },
    });
    expect(result).toMatchObject({
      status: ChatOperationStatus.AWAITING_CONFIRMATION,
      confirmationCount: 1, version: 1, requiredConfirmations: 2,
    });
    expect(audit.record).toHaveBeenCalledWith({
      action: 'OPERATION_ACKNOWLEDGED', conversationId: 'conversation-1', operationId: 'operation-1',
    }, tx);
  });

  it('returns the already-acknowledged state on a repeated click without incrementing again', async () => {
    const { handler, tx, audit } = harness({
      status: ChatOperationStatus.AWAITING_CONFIRMATION,
      confirmationCount: 1,
      version: 1,
    });

    const result = await handler.execute({ operationId: 'operation-1', clientId: 'client-1', expectedVersion: 0 });

    expect(result).toMatchObject({ confirmationCount: 1, version: 1 });
    expect(tx.chatOperation.updateMany).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('expires an acknowledged operation at the exact boundary instead of returning it as confirmable', async () => {
    const { handler } = harness({
      status: ChatOperationStatus.AWAITING_CONFIRMATION,
      confirmationCount: 1,
      version: 1,
      expiresAt: new Date('2026-08-13T09:00:00.000Z'),
    });

    const result = await handler.execute({
      operationId: 'operation-1', clientId: 'client-1', expectedVersion: 0,
    });

    expect(result).toMatchObject({ status: ChatOperationStatus.EXPIRED, version: 2 });
  });

  it('returns an already-terminal operation without incrementing its version again', async () => {
    const { handler, tx } = harness({
      status: ChatOperationStatus.EXPIRED,
      version: 2,
      expiresAt: new Date('2026-08-13T08:00:00.000Z'),
    });

    const result = await handler.execute({
      operationId: 'operation-1', clientId: 'client-1', expectedVersion: 0,
    });

    expect(result).toMatchObject({ status: ChatOperationStatus.EXPIRED, version: 2 });
    expect(tx.chatOperation.updateMany).not.toHaveBeenCalled();
  });

  it('rejects stale state before acknowledging', async () => {
    const { handler } = harness({ version: 3 });
    await expect(handler.execute({
      operationId: 'operation-1', clientId: 'client-1', expectedVersion: 2,
    })).rejects.toThrow(ConflictException);
  });

  it('rejects IDOR and guest-owned operations', async () => {
    const { handler } = harness();
    await expect(handler.execute({
      operationId: 'operation-1', clientId: 'other-client', expectedVersion: 0,
    })).rejects.toThrow(ForbiddenException);
  });

  it('rejects an operation whose conversation is not owned by the authenticated client', async () => {
    const { handler } = harness({}, false);

    await expect(handler.execute({
      operationId: 'operation-1', clientId: 'client-1', expectedVersion: 0,
    })).rejects.toThrow(ForbiddenException);
  });
});
