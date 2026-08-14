import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  BookingStatus,
  ChatOperationStatus,
  ChatOperationType,
  DeliveryType,
} from '@prisma/client';
import { ChatBookingQuoteService } from './chat-booking-quote.service';
import { ChatAuditService } from '../chat-audit.service';
import { ResumeChatOperationsHandler } from './resume-chat-operations.handler';

const NOW = new Date('2026-08-13T09:00:00.000Z');
const START = new Date('2026-08-15T09:00:00.000Z');
const END = new Date('2026-08-15T10:00:00.000Z');

const freshQuote = {
  payload: {
    branchId: 'branch-1',
    employeeId: 'employee-1',
    serviceId: 'service-1',
    scheduledAt: START.toISOString(),
    endsAt: END.toISOString(),
    durationMins: 60,
    durationOptionId: null,
    bookingType: 'INDIVIDUAL',
    deliveryType: DeliveryType.IN_PERSON,
    price: 25_000,
    currency: 'SAR',
  },
  summary: {
    action: 'CREATE_BOOKING',
    scheduledAt: START.toISOString(),
    endsAt: END.toISOString(),
    durationMins: 60,
    price: 25_000,
    currency: 'SAR',
    serviceName: 'جلسة أسرية',
    employeeName: 'سارة',
    branchName: 'الرئيسي',
    deliveryType: DeliveryType.IN_PERSON,
  },
};

function guestOperation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'guest-operation-1',
    conversationId: 'conversation-1',
    clientId: null,
    type: ChatOperationType.CREATE_BOOKING,
    status: ChatOperationStatus.AWAITING_AUTH,
    payload: {
      intent: 'CREATE_BOOKING',
      request: {
        branchId: 'branch-1',
        employeeId: 'employee-1',
        serviceId: 'service-1',
        scheduledAt: START.toISOString(),
        durationOptionId: null,
        deliveryType: DeliveryType.IN_PERSON,
      },
    },
    summary: { action: 'LOGIN_REQUIRED', intent: 'CREATE_BOOKING' },
    idempotencyKey: 'chat:message-1:prepareBooking:fingerprint',
    requiredConfirmations: 0,
    confirmationCount: 0,
    version: 0,
    expiresAt: new Date(NOW.getTime() + 10 * 60_000),
    confirmedAt: null,
    executedAt: null,
    bookingId: null,
    resultMessageId: null,
    errorCode: null,
    authResumedAt: null,
    authResumeMessageId: null,
    resumedFromOperationId: null,
    resumedOperationId: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function applyData(target: Record<string, any>, data: Record<string, any>) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && 'increment' in value) {
      target[key] = (target[key] ?? 0) + value.increment;
    } else {
      target[key] = value;
    }
  }
  return target;
}

function buildHarness(input: {
  operation?: Record<string, any>;
  futureBookings?: Array<Record<string, unknown>>;
} = {}) {
  const operations = new Map<string, Record<string, any>>();
  const original = input.operation ?? guestOperation();
  operations.set(original.id, original);
  let nextOperation = 1;
  let nextMessage = 1;
  const chatOperation = {
    findMany: jest.fn().mockImplementation(async () => [...operations.values()].filter((operation) =>
      !operation.resumedFromOperationId
      && (operation.status === ChatOperationStatus.AWAITING_AUTH || operation.authResumedAt))),
    findUnique: jest.fn().mockImplementation(async ({ where }: any) => operations.get(where.id) ?? null),
    findUniqueOrThrow: jest.fn().mockImplementation(async ({ where }: any) => {
      const operation = operations.get(where.id);
      if (!operation) throw new Error('not found');
      return operation;
    }),
    create: jest.fn().mockImplementation(async ({ data }: any) => {
      const operation = {
        id: `resumed-operation-${nextOperation++}`,
        confirmationCount: 0,
        version: 0,
        confirmedAt: null,
        bookingId: null,
        resultMessageId: null,
        errorCode: null,
        authResumedAt: null,
        authResumeMessageId: null,
        resumedOperationId: null,
        createdAt: NOW,
        updatedAt: NOW,
        ...data,
      };
      operations.set(operation.id, operation);
      return operation;
    }),
    update: jest.fn().mockImplementation(async ({ where, data }: any) => {
      const operation = operations.get(where.id);
      if (!operation) throw new Error('not found');
      return applyData(operation, data);
    }),
  };
  const prisma = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn().mockResolvedValue(1),
    chatOperation,
    chatConversation: {
      findFirst: jest.fn().mockResolvedValue({ id: 'conversation-1', language: 'ar' }),
      update: jest.fn().mockResolvedValue({}),
    },
    commsChatMessage: {
      create: jest.fn().mockImplementation(async ({ data }: any) => ({
        id: `message-${nextMessage++}`,
        ...data,
      })),
    },
    booking: { findMany: jest.fn().mockResolvedValue(input.futureBookings ?? []) },
  };
  const quote = {
    quoteBooking: jest.fn().mockResolvedValue(freshQuote),
    quoteReschedule: jest.fn(),
    quoteCancellation: jest.fn(),
  };
  const rls = {
    withTransaction: jest.fn((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const handler = new ResumeChatOperationsHandler(
    prisma as never,
    rls as never,
    quote as unknown as ChatBookingQuoteService,
    audit as unknown as ChatAuditService,
  );
  return { handler, prisma, quote, audit, operations, original };
}

describe('ResumeChatOperationsHandler', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  it('revalidates a guest booking after claim and stores the current quote for exactly fifteen minutes', async () => {
    const { handler, quote, original } = buildHarness();

    const [resumed] = await handler.execute({ conversationId: 'conversation-1', clientId: 'client-1' });

    expect(quote.quoteBooking).toHaveBeenCalledWith(expect.objectContaining({
      clientId: 'client-1',
      branchId: 'branch-1',
      scheduledAt: START.toISOString(),
      transaction: expect.anything(),
    }));
    expect(resumed).toMatchObject({
      status: ChatOperationStatus.AWAITING_CONFIRMATION,
      clientId: 'client-1',
      payload: expect.objectContaining({ price: 25_000 }),
      summary: expect.objectContaining({ price: 25_000 }),
      requiredConfirmations: 1,
      expiresAt: new Date('2026-08-13T09:15:00.000Z'),
      resumedFromOperationId: original.id,
    });
    expect(original).toMatchObject({
      status: ChatOperationStatus.DECLINED,
      clientId: 'client-1',
      errorCode: 'RESUMED_AFTER_AUTH',
      resumedOperationId: resumed!.id,
    });
  });

  it('requires acknowledgement and a separate confirmation when another future active booking exists', async () => {
    const { handler } = buildHarness({ futureBookings: [{
      id: 'existing-booking',
      scheduledAt: new Date('2026-08-14T09:00:00.000Z'),
      endsAt: new Date('2026-08-14T10:00:00.000Z'),
      durationMins: 60,
      status: BookingStatus.CONFIRMED,
      serviceNameSnapshot: 'متابعة',
      employeeNameSnapshot: 'محمد',
      branchNameSnapshot: 'الرئيسي',
      deliveryType: DeliveryType.IN_PERSON,
    }] });

    const [resumed] = await handler.execute({ conversationId: 'conversation-1', clientId: 'client-1' });

    expect(resumed).toMatchObject({
      status: ChatOperationStatus.AWAITING_EXISTING_BOOKING_ACK,
      requiredConfirmations: 2,
      confirmationCount: 0,
      summary: expect.objectContaining({ existingBooking: expect.any(Object) }),
    });
  });

  it('returns the same replacement on a repeated resume without another quote or message', async () => {
    const { handler, quote, prisma } = buildHarness();
    const [first] = await handler.execute({ conversationId: 'conversation-1', clientId: 'client-1' });
    const [second] = await handler.execute({ conversationId: 'conversation-1', clientId: 'client-1' });

    expect(second!.id).toBe(first!.id);
    expect(quote.quoteBooking).toHaveBeenCalledTimes(1);
    expect(prisma.commsChatMessage.create).toHaveBeenCalledTimes(1);
  });

  it('expires an elapsed guest intent without quoting or creating a card', async () => {
    const { handler, quote, prisma, audit } = buildHarness({
      operation: guestOperation({ expiresAt: NOW }),
    });

    const [expired] = await handler.execute({ conversationId: 'conversation-1', clientId: 'client-1' });

    expect(expired).toMatchObject({ status: ChatOperationStatus.EXPIRED, errorCode: 'AUTH_INTENT_EXPIRED' });
    expect(quote.quoteBooking).not.toHaveBeenCalled();
    expect(prisma.commsChatMessage.create).not.toHaveBeenCalled();
  });

  it('resumes list-own with no model arguments and writes one safe terminal result', async () => {
    const { handler, quote, prisma, audit } = buildHarness({
      operation: guestOperation({
        type: ChatOperationType.LIST_OWN_APPOINTMENTS,
        payload: { intent: 'LIST_OWN_APPOINTMENTS', request: {} },
      }),
    });

    const [resumed] = await handler.execute({ conversationId: 'conversation-1', clientId: 'client-1' });

    expect(resumed).toMatchObject({
      type: ChatOperationType.LIST_OWN_APPOINTMENTS,
      status: ChatOperationStatus.SUCCEEDED,
      requiredConfirmations: 0,
      resultMessageId: 'message-1',
    });
    expect(quote.quoteBooking).not.toHaveBeenCalled();
    expect(prisma.commsChatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        body: 'لا توجد مواعيد مسجلة حاليًا.',
        metadata: expect.objectContaining({ outcome: 'APPOINTMENTS_LISTED' }),
      }),
    });
    expect(audit.record).toHaveBeenCalledWith({
      action: 'OPERATION_SUCCEEDED', conversationId: 'conversation-1', operationId: resumed!.id,
    }, prisma);
  });

  it('keeps the claimed conversation and emits a safe failed result when availability changed', async () => {
    const { handler, quote, prisma, audit } = buildHarness();
    quote.quoteBooking.mockRejectedValueOnce(new BadRequestException('slot unavailable'));

    const [failed] = await handler.execute({ conversationId: 'conversation-1', clientId: 'client-1' });

    expect(failed).toMatchObject({
      status: ChatOperationStatus.FAILED,
      clientId: 'client-1',
      errorCode: 'REQUEST_NO_LONGER_AVAILABLE',
    });
    expect(prisma.commsChatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ metadata: expect.objectContaining({ outcome: 'OPERATION_FAILED' }) }),
    });
    expect(audit.record).toHaveBeenCalledWith({
      action: 'OPERATION_FAILED', conversationId: 'conversation-1', operationId: failed!.id,
    }, prisma);
  });

  it('rethrows transient quote failures so the durable outbox consumer can retry', async () => {
    const { handler, quote, prisma, original } = buildHarness();
    quote.quoteBooking.mockRejectedValueOnce(new Error('database temporarily unavailable'));

    await expect(handler.execute({ conversationId: 'conversation-1', clientId: 'client-1' }))
      .rejects.toThrow('database temporarily unavailable');

    expect(original.status).toBe(ChatOperationStatus.AWAITING_AUTH);
    expect(prisma.commsChatMessage.create).not.toHaveBeenCalled();
  });

  it.each([
    [ChatOperationType.RESCHEDULE_BOOKING, 'quoteReschedule', {
      intent: 'RESCHEDULE_BOOKING', request: { bookingId: 'booking-1', newScheduledAt: START.toISOString() },
    }],
    [ChatOperationType.CANCEL_BOOKING, 'quoteCancellation', {
      intent: 'CANCEL_BOOKING', request: { bookingId: 'booking-1' },
    }],
  ] as const)('fails %s safely when authenticated ownership revalidation fails', async (type, method, payload) => {
    const { handler, quote } = buildHarness({ operation: guestOperation({ type, payload }) });
    quote[method].mockRejectedValueOnce(new ForbiddenException('not owner'));

    const [failed] = await handler.execute({ conversationId: 'conversation-1', clientId: 'client-1' });

    expect(failed).toMatchObject({
      status: ChatOperationStatus.FAILED,
      errorCode: 'OWNERSHIP_REVALIDATION_FAILED',
    });
  });
});
