import { ConflictException } from '@nestjs/common';
import { BookingStatus, ChatOperationStatus, ChatOperationType, DeliveryType } from '@prisma/client';
import { ACTIVE_BOOKING_STATUSES } from '../../../bookings/active-booking-statuses';
import { ChatBookingQuoteService } from './chat-booking-quote.service';
import { PrepareBookingHandler } from './prepare-booking.handler';

const NOW = new Date('2026-08-13T09:00:00.000Z');
const START = new Date('2026-08-15T09:00:00.000Z');
const END = new Date('2026-08-15T10:00:00.000Z');

const proposed = {
  payload: {
    branchId: 'branch-1',
    employeeId: 'employee-1',
    serviceId: 'service-1',
    scheduledAt: START.toISOString(),
    endsAt: END.toISOString(),
    durationMins: 60,
    durationOptionId: 'duration-1',
    bookingType: 'INDIVIDUAL',
    deliveryType: DeliveryType.IN_PERSON,
    price: 20_000,
    currency: 'SAR',
  },
  summary: {
    action: 'CREATE_BOOKING',
    scheduledAt: START.toISOString(),
    endsAt: END.toISOString(),
    durationMins: 60,
    price: 20_000,
    currency: 'SAR',
    serviceName: 'جلسة إرشاد أسري',
    employeeName: 'سارة',
    branchName: 'الفرع الرئيسي',
    deliveryType: DeliveryType.IN_PERSON,
  },
};

function buildHarness(input: { clientId: string | null; futureBookings?: Array<Record<string, unknown>> }) {
  const futureBookings = input.futureBookings ?? [];
  const prisma = {
    chatConversation: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'conversation-1',
        clientId: input.clientId,
        language: 'ar',
      }),
    },
    booking: { findMany: jest.fn().mockResolvedValue(futureBookings) },
    chatOperation: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
        id: 'operation-1',
        confirmationCount: 0,
        version: 0,
        bookingId: null,
        errorCode: null,
        resultMessageId: null,
        createdAt: NOW,
        updatedAt: NOW,
        ...data,
      })),
    },
  };
  const quote = {
    quoteBooking: jest.fn().mockResolvedValue(proposed),
  };
  const rls = {
    withTransaction: jest.fn((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
  };
  const handler = new PrepareBookingHandler(
    prisma as never,
    rls as never,
    quote as unknown as ChatBookingQuoteService,
  );
  return { handler, prisma, quote };
}

describe('PrepareBookingHandler', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates AWAITING_AUTH for a guest without quote, booking, phone, or WALK_IN lookup', async () => {
    const { handler, prisma, quote } = buildHarness({ clientId: null });

    const operation = await handler.execute({
      conversationId: 'conversation-1',
      clientId: null,
      sourceMessageId: 'message-1',
      branchId: 'branch-1',
      employeeId: 'employee-1',
      serviceId: 'service-1',
      scheduledAt: START.toISOString(),
      deliveryType: DeliveryType.IN_PERSON,
    });

    expect(operation).toMatchObject({
      id: 'operation-1',
      type: ChatOperationType.CREATE_BOOKING,
      status: ChatOperationStatus.AWAITING_AUTH,
      requiredConfirmations: 0,
      confirmationCount: 0,
      version: 0,
    });
    expect(operation.expiresAt).toEqual(new Date(NOW.getTime() + 15 * 60_000));
    expect(quote.quoteBooking).not.toHaveBeenCalled();
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
    expect(JSON.stringify(prisma.chatOperation.create.mock.calls[0])).not.toMatch(/phone|WALK_IN|clientId.*forged/i);
  });

  it('stores an immutable validated quote and expires exactly fifteen minutes after prepare', async () => {
    const { handler, prisma } = buildHarness({ clientId: 'client-1' });

    const operation = await handler.execute({
      conversationId: 'conversation-1',
      clientId: 'client-1',
      sourceMessageId: 'message-1',
      branchId: 'branch-1',
      employeeId: 'employee-1',
      serviceId: 'service-1',
      scheduledAt: START.toISOString(),
      durationOptionId: 'duration-1',
      deliveryType: DeliveryType.IN_PERSON,
    });

    expect(operation).toMatchObject({
      status: ChatOperationStatus.AWAITING_CONFIRMATION,
      requiredConfirmations: 1,
      confirmationCount: 0,
      version: 0,
      payload: proposed.payload,
      summary: proposed.summary,
    });
    expect(operation.expiresAt).toEqual(new Date('2026-08-13T09:15:00.000Z'));
    expect(prisma.chatOperation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        payload: proposed.payload,
        summary: proposed.summary,
        expiresAt: new Date('2026-08-13T09:15:00.000Z'),
      }),
    });
  });

  it('uses every active status and excludes historical rows when checking future appointments', async () => {
    const { handler, prisma } = buildHarness({ clientId: 'client-1' });

    await handler.execute({
      conversationId: 'conversation-1',
      clientId: 'client-1',
      sourceMessageId: 'message-1',
      branchId: 'branch-1',
      employeeId: 'employee-1',
      serviceId: 'service-1',
      scheduledAt: START.toISOString(),
      deliveryType: DeliveryType.IN_PERSON,
    });

    expect(ACTIVE_BOOKING_STATUSES).toEqual(expect.arrayContaining([
      BookingStatus.PENDING,
      BookingStatus.PENDING_GROUP_FILL,
      BookingStatus.AWAITING_PAYMENT,
      BookingStatus.CONFIRMED,
      BookingStatus.CANCEL_REQUESTED,
      BookingStatus.DEPOSIT_PAID,
    ]));
    expect(ACTIVE_BOOKING_STATUSES).not.toEqual(expect.arrayContaining([
      BookingStatus.CANCELLED,
      BookingStatus.COMPLETED,
      BookingStatus.NO_SHOW,
      BookingStatus.EXPIRED,
    ]));
    expect(prisma.booking.findMany).toHaveBeenCalledWith({
      where: {
        clientId: 'client-1',
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
        isHistoricalImport: false,
        scheduledAt: { gt: NOW },
      },
      orderBy: { scheduledAt: 'asc' },
      select: expect.objectContaining({ id: true, scheduledAt: true, endsAt: true }),
    });
  });

  it('requires acknowledgement and then confirmation for a different future appointment', async () => {
    const existing = {
      id: 'booking-existing',
      scheduledAt: new Date('2026-08-14T09:00:00.000Z'),
      endsAt: new Date('2026-08-14T10:00:00.000Z'),
      durationMins: 60,
      status: BookingStatus.CONFIRMED,
      serviceNameSnapshot: 'جلسة متابعة',
      employeeNameSnapshot: 'محمد',
      branchNameSnapshot: 'الفرع',
      deliveryType: DeliveryType.IN_PERSON,
    };
    const { handler } = buildHarness({ clientId: 'client-1', futureBookings: [existing] });

    const operation = await handler.execute({
      conversationId: 'conversation-1',
      clientId: 'client-1',
      sourceMessageId: 'message-1',
      branchId: 'branch-1',
      employeeId: 'employee-1',
      serviceId: 'service-1',
      scheduledAt: START.toISOString(),
      deliveryType: DeliveryType.IN_PERSON,
    });

    expect(operation).toMatchObject({
      status: ChatOperationStatus.AWAITING_EXISTING_BOOKING_ACK,
      requiredConfirmations: 2,
      confirmationCount: 0,
      summary: expect.objectContaining({
        proposedBooking: proposed.summary,
        existingBooking: expect.objectContaining({ id: 'booking-existing' }),
      }),
    });
  });

  it.each([
    ['exact duplicate', START, END],
    ['partial overlap', new Date('2026-08-15T08:30:00.000Z'), new Date('2026-08-15T09:30:00.000Z')],
  ])('blocks an %s instead of offering double confirmation', async (_label, scheduledAt, endsAt) => {
    const { handler, prisma } = buildHarness({
      clientId: 'client-1',
      futureBookings: [{
        id: 'booking-conflict',
        scheduledAt,
        endsAt,
        durationMins: 60,
        status: BookingStatus.CONFIRMED,
        serviceNameSnapshot: 'Existing',
        employeeNameSnapshot: 'Existing',
        branchNameSnapshot: 'Existing',
        deliveryType: DeliveryType.IN_PERSON,
      }],
    });

    await expect(handler.execute({
      conversationId: 'conversation-1',
      clientId: 'client-1',
      sourceMessageId: 'message-1',
      branchId: 'branch-1',
      employeeId: 'employee-1',
      serviceId: 'service-1',
      scheduledAt: START.toISOString(),
      deliveryType: DeliveryType.IN_PERSON,
    })).rejects.toThrow(ConflictException);
    expect(prisma.chatOperation.create).not.toHaveBeenCalled();
  });
});
