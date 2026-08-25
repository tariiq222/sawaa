import { ChatOperationStatus, ChatOperationType } from '@prisma/client';
import { ListOwnAppointmentsHandler } from './list-own-appointments.handler';

function harness(clientId: string | null) {
  const operation = {
    id: 'operation-1', conversationId: 'conversation-1', clientId,
    type: ChatOperationType.LIST_OWN_APPOINTMENTS,
    status: ChatOperationStatus.AWAITING_AUTH,
    payload: { intent: 'LIST_OWN_APPOINTMENTS', request: {} },
    summary: { action: 'LOGIN_REQUIRED', intent: 'LIST_OWN_APPOINTMENTS' },
    idempotencyKey: 'key', requiredConfirmations: 0, confirmationCount: 0,
    version: 0, expiresAt: new Date('2026-08-13T09:15:00.000Z'),
  };
  const prisma: any = {
    chatConversation: { findUnique: jest.fn().mockResolvedValue({ id: 'conversation-1', clientId }) },
    chatOperation: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(operation) },
    client: { findFirst: jest.fn() },
  };
  const list = { execute: jest.fn().mockResolvedValue({ items: [{ id: 'booking-1' }], total: 1, page: 1, pageSize: 10 }) };
  const rls = { withTransaction: jest.fn((fn) => fn(prisma)) };
  return { handler: new ListOwnAppointmentsHandler(prisma, rls as never, list as never), prisma, list };
}

describe('ListOwnAppointmentsHandler', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-08-13T09:00:00.000Z')));
  afterEach(() => jest.useRealTimers());

  it('creates an AWAITING_AUTH operation for a guest without any phone or booking lookup', async () => {
    const { handler, prisma, list } = harness(null);
    const result = await handler.execute({
      conversationId: 'conversation-1', clientId: null, sourceMessageId: 'message-1',
    });

    expect(result.kind).toBe('AUTH_REQUIRED');
    if (result.kind !== 'AUTH_REQUIRED') throw new Error('expected auth operation');
    expect(result.operation).toMatchObject({
      type: ChatOperationType.LIST_OWN_APPOINTMENTS,
      status: ChatOperationStatus.AWAITING_AUTH,
      requiredConfirmations: 0,
    });
    expect(result.operation.expiresAt).toEqual(new Date('2026-08-13T09:15:00.000Z'));
    expect(result.operation.payload).toEqual({ intent: 'LIST_OWN_APPOINTMENTS', request: {} });
    expect(list.execute).not.toHaveBeenCalled();
    expect(prisma.client.findFirst).not.toHaveBeenCalled();
  });

  it('uses only authenticated context identity to list appointments', async () => {
    const { handler, list } = harness('client-real');
    const result = await handler.execute({
      conversationId: 'conversation-1', clientId: 'client-real', sourceMessageId: 'message-1',
    });

    expect(result).toMatchObject({ kind: 'APPOINTMENTS', appointments: { total: 1 } });
    expect(list.execute).toHaveBeenCalledWith('client-real', 1, 10);
  });
});
