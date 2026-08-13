import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  ChatMessageKind,
  ChatOperationStatus,
  ChatOperationType,
  DeliveryType,
} from '@prisma/client';
import { ConfirmOperationHandler } from './confirm-operation.handler';
import { bookingCreationRequestHash } from '../../../bookings/create-booking/creation-request-hash';

const NOW = new Date('2026-08-13T09:00:00.000Z');
const bookingPayload = {
  branchId: 'branch-1', employeeId: 'employee-1', serviceId: 'service-1',
  scheduledAt: '2026-08-20T09:00:00.000Z', endsAt: '2026-08-20T10:00:00.000Z',
  durationMins: 60, durationOptionId: 'duration-1', bookingType: 'INDIVIDUAL',
  deliveryType: DeliveryType.IN_PERSON, price: 300, currency: 'SAR',
};

const baseOperation: any = {
  id: '11111111-1111-4111-8111-111111111111',
  conversationId: 'conversation-1', clientId: 'client-1',
  type: ChatOperationType.CREATE_BOOKING,
  status: ChatOperationStatus.AWAITING_CONFIRMATION,
  payload: bookingPayload,
  summary: { action: 'CREATE_BOOKING', serviceName: 'استشارة' },
  idempotencyKey: 'operation-key', requiredConfirmations: 1,
  confirmationCount: 0, version: 0,
  expiresAt: new Date('2026-08-13T09:15:00.000Z'),
  confirmedAt: null, executedAt: null, bookingId: null, resultMessageId: null,
  errorCode: null, createdAt: NOW, updatedAt: NOW,
};

function harness(overrides: Record<string, unknown> = {}, futureBooking: object | null = null) {
  let operation: any = { ...baseOperation, ...overrides };
  let messageSequence = 0;
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: operation.id }]),
    $executeRaw: jest.fn().mockResolvedValue(undefined),
    chatOperation: {
      findUnique: jest.fn().mockImplementation(async () => ({ ...operation })),
      updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
        const statusMatches = where.status === undefined || where.status === operation.status;
        if (where.id !== operation.id || (where.version !== undefined && where.version !== operation.version) || !statusMatches) {
          return { count: 0 };
        }
        operation = applyData(operation, data);
        return { count: 1 };
      }),
      update: jest.fn().mockImplementation(async ({ data }) => {
        operation = applyData(operation, data);
        return { ...operation };
      }),
    },
    chatConversation: {
      findFirst: jest.fn().mockImplementation(async ({ where }) =>
        where.id === operation.conversationId && where.clientId === operation.clientId
          ? { id: operation.conversationId, clientId: operation.clientId, stateVersion: 4 }
          : null),
      update: jest.fn().mockResolvedValue({ id: 'conversation-1', stateVersion: 5 }),
    },
    commsChatMessage: {
      create: jest.fn().mockImplementation(async ({ data }) => ({
        id: `message-${++messageSequence}`, ...data,
      })),
    },
    booking: {
      findFirst: jest.fn().mockResolvedValue(futureBooking),
      findUnique: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    bookingStatusLog: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };
  let queue = Promise.resolve();
  const rls = {
    withTransaction: jest.fn((fn: (db: typeof tx) => Promise<unknown>) => {
      const result = queue.then(async () => {
        const snapshot = { ...operation };
        try {
          return await fn(tx);
        } catch (error) {
          operation = snapshot;
          throw error;
        }
      });
      queue = result.then(() => undefined, () => undefined);
      return result;
    }),
  };
  const quote = {
    quoteBooking: jest.fn().mockResolvedValue({ payload: bookingPayload, summary: {} }),
    quoteReschedule: jest.fn(),
    quoteCancellation: jest.fn(),
  };
  const createBooking = { execute: jest.fn().mockResolvedValue({ id: 'booking-1' }) };
  const reschedule = { execute: jest.fn() };
  const cancellation = { execute: jest.fn() };
  const handler = new ConfirmOperationHandler(
    rls as never, quote as never, createBooking as never,
    reschedule as never, cancellation as never,
  );
  return { handler, tx, rls, quote, createBooking, reschedule, cancellation, getOperation: () => operation };
}

function applyData(current: any, data: any) {
  const next = { ...current, ...data };
  if (data.version?.increment) next.version = current.version + data.version.increment;
  if (data.confirmationCount?.increment) {
    next.confirmationCount = current.confirmationCount + data.confirmationCount.increment;
  }
  return next;
}

describe('ConfirmOperationHandler', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  it('revalidates the immutable quote and creates once using operation identity only', async () => {
    const { handler, tx, quote, createBooking } = harness();

    const result = await handler.execute({
      operationId: baseOperation.id, clientId: 'client-1', expectedVersion: 0,
    });

    expect(quote.quoteBooking).toHaveBeenCalledWith(expect.objectContaining({
      clientId: 'client-1', branchId: 'branch-1', employeeId: 'employee-1',
      serviceId: 'service-1', scheduledAt: bookingPayload.scheduledAt,
      transaction: tx,
    }));
    expect(createBooking.execute).toHaveBeenCalledWith(expect.objectContaining({
      clientId: 'client-1', source: 'AI_CHAT',
      creationIdempotencyKey: `chat-operation:${baseOperation.id}`,
      transaction: tx,
    }));
    expect(result).toMatchObject({
      status: ChatOperationStatus.SUCCEEDED, bookingId: 'booking-1',
      confirmationCount: 1, resultMessageId: 'message-1',
    });
    expect(tx.commsChatMessage.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      kind: ChatMessageKind.OPERATION_RESULT,
      metadata: {
        operationId: baseOperation.id,
        type: ChatOperationType.CREATE_BOOKING,
        status: ChatOperationStatus.SUCCEEDED,
        bookingId: 'booking-1',
        outcome: 'BOOKING_CREATED',
      },
    }) });
    expect(JSON.stringify(tx.commsChatMessage.create.mock.calls[0][0].data.metadata)).not.toMatch(/price|clientId|employeeId/);
    expect(tx.chatConversation.update).toHaveBeenCalledWith({
      where: { id: 'conversation-1' },
      data: expect.objectContaining({
        stateVersion: { increment: 1 },
        assistantLeaseOwner: null,
        assistantLeaseExpiresAt: null,
      }),
    });
  });

  it('requires the separate acknowledgement before confirming an additional booking', async () => {
    const { handler, createBooking } = harness({
      status: ChatOperationStatus.AWAITING_EXISTING_BOOKING_ACK,
      requiredConfirmations: 2,
    });
    await expect(handler.execute({
      operationId: baseOperation.id, clientId: 'client-1', expectedVersion: 0,
    })).rejects.toThrow(BadRequestException);
    expect(createBooking.execute).not.toHaveBeenCalled();
  });

  it('executes after acknowledgement and records the second confirmation', async () => {
    const { handler, createBooking } = harness({ requiredConfirmations: 2, confirmationCount: 1, version: 1 });
    const result = await handler.execute({
      operationId: baseOperation.id, clientId: 'client-1', expectedVersion: 1,
    });
    expect(result.confirmationCount).toBe(2);
    expect(createBooking.execute).toHaveBeenCalledTimes(1);
  });

  it('expires at the exact boundary without executing', async () => {
    const { handler, createBooking } = harness({ expiresAt: NOW });
    const result = await handler.execute({
      operationId: baseOperation.id, clientId: 'client-1', expectedVersion: 0,
    });
    expect(result.status).toBe(ChatOperationStatus.EXPIRED);
    expect(createBooking.execute).not.toHaveBeenCalled();
  });

  it.each([
    ChatOperationStatus.SUCCEEDED,
    ChatOperationStatus.DECLINED,
    ChatOperationStatus.FAILED,
    ChatOperationStatus.EXPIRED,
  ])('does not re-execute terminal state %s', async (status) => {
    const { handler, createBooking } = harness({ status, bookingId: status === ChatOperationStatus.SUCCEEDED ? 'booking-1' : null });
    const result = await handler.execute({
      operationId: baseOperation.id, clientId: 'client-1', expectedVersion: 0,
    });
    expect(result.status).toBe(status);
    expect(createBooking.execute).not.toHaveBeenCalled();
  });

  it('rejects operation ownership IDOR before mutation', async () => {
    const { handler, createBooking } = harness();
    await expect(handler.execute({
      operationId: baseOperation.id, clientId: 'other-client', expectedVersion: 0,
    })).rejects.toThrow(ForbiddenException);
    expect(createBooking.execute).not.toHaveBeenCalled();
  });

  it('fails safely when the fresh quote differs from the immutable payload', async () => {
    const { handler, quote, createBooking, tx } = harness();
    quote.quoteBooking.mockResolvedValue({ payload: { ...bookingPayload, price: 301 }, summary: {} });

    const result = await handler.execute({
      operationId: baseOperation.id, clientId: 'client-1', expectedVersion: 0,
    });

    expect(result).toMatchObject({
      status: ChatOperationStatus.FAILED,
      errorCode: 'QUOTE_CHANGED',
      version: 1,
    });
    expect(createBooking.execute).not.toHaveBeenCalled();
    expect(tx.commsChatMessage.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      kind: ChatMessageKind.OPERATION_RESULT,
      metadata: expect.objectContaining({ status: ChatOperationStatus.FAILED }),
    }) });
  });

  it('requires a new prepare when a future active booking appears after the one-confirmation quote', async () => {
    const { handler, createBooking, tx } = harness({}, { id: 'new-existing-booking' });

    const result = await handler.execute({
      operationId: baseOperation.id, clientId: 'client-1', expectedVersion: 0,
    });

    expect(result).toMatchObject({
      status: ChatOperationStatus.FAILED,
      errorCode: 'EXISTING_BOOKING_CHANGED',
    });
    expect(tx.booking.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        clientId: 'client-1',
        isHistoricalImport: false,
        scheduledAt: { gt: NOW },
      }),
      select: { id: true },
    });
    expect(createBooking.execute).not.toHaveBeenCalled();
  });

  it('recovers an already-created booking by the durable creation key before quote/card retry', async () => {
    const { handler, tx, quote, createBooking } = harness();
    tx.booking.findUnique.mockResolvedValue({
      id: 'booking-recovered', clientId: 'client-1',
      branchId: bookingPayload.branchId, employeeId: bookingPayload.employeeId,
      serviceId: bookingPayload.serviceId,
      scheduledAt: new Date(bookingPayload.scheduledAt), endsAt: new Date(bookingPayload.endsAt),
      durationMins: bookingPayload.durationMins, durationOptionId: bookingPayload.durationOptionId,
      bookingType: bookingPayload.bookingType, deliveryType: bookingPayload.deliveryType,
      price: bookingPayload.price, currency: bookingPayload.currency, source: 'AI_CHAT',
      creationRequestHash: bookingCreationRequestHash({
        ...bookingPayload,
        clientId: 'client-1',
        source: 'AI_CHAT',
      }),
    });

    const result = await handler.execute({
      operationId: baseOperation.id, clientId: 'client-1', expectedVersion: 0,
    });

    expect(result).toMatchObject({ status: ChatOperationStatus.SUCCEEDED, bookingId: 'booking-recovered' });
    expect(quote.quoteBooking).not.toHaveBeenCalled();
    expect(createBooking.execute).not.toHaveBeenCalled();
  });

  it('backfills a matching legacy booking hash while recovering a crashed create operation', async () => {
    const { handler, tx, quote, createBooking } = harness();
    tx.booking.findUnique.mockResolvedValue({
      id: 'booking-recovered', clientId: 'client-1',
      branchId: bookingPayload.branchId, employeeId: bookingPayload.employeeId,
      serviceId: bookingPayload.serviceId,
      scheduledAt: new Date(bookingPayload.scheduledAt), endsAt: new Date(bookingPayload.endsAt),
      durationMins: bookingPayload.durationMins, durationOptionId: bookingPayload.durationOptionId,
      bookingType: bookingPayload.bookingType, deliveryType: bookingPayload.deliveryType,
      price: bookingPayload.price, currency: bookingPayload.currency, source: 'AI_CHAT',
      creationRequestHash: null,
    });

    const result = await handler.execute({
      operationId: baseOperation.id, clientId: 'client-1', expectedVersion: 0,
    });

    expect(result).toMatchObject({ status: ChatOperationStatus.SUCCEEDED, bookingId: 'booking-recovered' });
    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-recovered', creationRequestHash: null },
      data: { creationRequestHash: bookingCreationRequestHash({
        ...bookingPayload, clientId: 'client-1', source: 'AI_CHAT',
      }) },
    });
    expect(quote.quoteBooking).not.toHaveBeenCalled();
    expect(createBooking.execute).not.toHaveBeenCalled();
  });

  it.each([
    [ChatOperationType.RESCHEDULE_BOOKING, 'BOOKING_RESCHEDULED'],
    [ChatOperationType.CANCEL_BOOKING, 'BOOKING_CANCELLED'],
  ] as const)('recovers durable %s mutation before revalidating a now-changed booking', async (type, outcome) => {
    const payload = type === ChatOperationType.RESCHEDULE_BOOKING
      ? {
          bookingId: 'booking-1', branchId: 'branch-1', employeeId: 'employee-1', serviceId: 'service-1',
          oldScheduledAt: '2026-08-18T09:00:00.000Z', newScheduledAt: '2026-08-20T09:00:00.000Z',
          newEndsAt: '2026-08-20T10:00:00.000Z', durationMins: 60, durationOptionId: null,
          bookingType: 'INDIVIDUAL', deliveryType: DeliveryType.IN_PERSON, price: 300, currency: 'SAR',
        }
      : {
          bookingId: 'booking-1', scheduledAt: '2026-08-18T09:00:00.000Z', durationMins: 60,
          status: 'CONFIRMED', deliveryType: DeliveryType.IN_PERSON,
        };
    const testHarness = harness({ type, payload });
    testHarness.tx.bookingStatusLog.findUnique.mockResolvedValue({ id: 'durable-result' });
    testHarness.reschedule.execute.mockResolvedValue({ booking: { id: 'booking-1' } });
    testHarness.cancellation.execute.mockResolvedValue({
      booking: { id: 'booking-1' }, status: 'CANCELLED', requiresApproval: false,
    });

    const result = await testHarness.handler.execute({
      operationId: baseOperation.id, clientId: 'client-1', expectedVersion: 0,
    });

    expect(result).toMatchObject({ status: ChatOperationStatus.SUCCEEDED, bookingId: 'booking-1' });
    expect(testHarness.tx.commsChatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ metadata: expect.objectContaining({ outcome }) }),
    });
    if (type === ChatOperationType.RESCHEDULE_BOOKING) {
      expect(testHarness.quote.quoteReschedule).not.toHaveBeenCalled();
    } else {
      expect(testHarness.quote.quoteCancellation).not.toHaveBeenCalled();
    }
  });

  it('serializes concurrent double clicks and returns the same success', async () => {
    const { handler, createBooking } = harness();
    const command = { operationId: baseOperation.id, clientId: 'client-1', expectedVersion: 0 };

    const [first, second] = await Promise.all([handler.execute(command), handler.execute(command)]);

    expect(createBooking.execute).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({ status: ChatOperationStatus.SUCCEEDED, bookingId: 'booking-1' });
    expect(second).toMatchObject({ status: ChatOperationStatus.SUCCEEDED, bookingId: 'booking-1' });
  });

  it('executes reschedule and cancellation from revalidated payloads with durable operation keys', async () => {
    const reschedulePayload = {
      bookingId: 'booking-1', branchId: 'branch-1', employeeId: 'employee-1', serviceId: 'service-1',
      oldScheduledAt: '2026-08-18T09:00:00.000Z', newScheduledAt: '2026-08-20T09:00:00.000Z',
      newEndsAt: '2026-08-20T10:00:00.000Z', durationMins: 60, durationOptionId: null,
      bookingType: 'INDIVIDUAL', deliveryType: DeliveryType.IN_PERSON, price: 300, currency: 'SAR',
    };
    const rescheduleHarness = harness({ type: ChatOperationType.RESCHEDULE_BOOKING, payload: reschedulePayload });
    rescheduleHarness.quote.quoteReschedule.mockResolvedValue({ payload: reschedulePayload, summary: {} });
    rescheduleHarness.reschedule.execute.mockResolvedValue({ booking: { id: 'booking-1' } });
    await rescheduleHarness.handler.execute({ operationId: baseOperation.id, clientId: 'client-1', expectedVersion: 0 });
    expect(rescheduleHarness.reschedule.execute).toHaveBeenCalledWith({
      bookingId: 'booking-1', clientId: 'client-1',
      newScheduledAt: reschedulePayload.newScheduledAt,
      sourceActionId: baseOperation.id,
      transaction: rescheduleHarness.tx,
    });

    const cancellationPayload = {
      bookingId: 'booking-2', scheduledAt: '2026-08-18T09:00:00.000Z', durationMins: 60,
      status: 'CONFIRMED', deliveryType: DeliveryType.IN_PERSON,
    };
    const cancelHarness = harness({ type: ChatOperationType.CANCEL_BOOKING, payload: cancellationPayload });
    cancelHarness.quote.quoteCancellation.mockResolvedValue({ payload: cancellationPayload, summary: {} });
    cancelHarness.cancellation.execute.mockResolvedValue({
      booking: { id: 'booking-2' }, status: 'CANCEL_REQUESTED', requiresApproval: true,
    });
    await cancelHarness.handler.execute({ operationId: baseOperation.id, clientId: 'client-1', expectedVersion: 0 });
    expect(cancelHarness.cancellation.execute).toHaveBeenCalledWith({
      bookingId: 'booking-2', clientId: 'client-1', sourceActionId: baseOperation.id,
      transaction: cancelHarness.tx,
    });
  });
});
