import { ChatOperationStatus, ChatOperationType, DeliveryType } from '@prisma/client';
import { ChatBookingQuoteService } from './chat-booking-quote.service';
import { PrepareCancellationHandler } from './prepare-cancellation.handler';
import { PrepareRescheduleHandler } from './prepare-reschedule.handler';

const NOW = new Date('2026-08-13T09:00:00.000Z');
const NEW_START = new Date('2026-08-15T09:00:00.000Z');

function buildHarness(clientId: string | null) {
  const prisma = {
    chatConversation: { findUnique: jest.fn().mockResolvedValue({ id: 'conversation-1', clientId }) },
    chatOperation: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
        id: 'operation-1', confirmationCount: 0, version: 0, bookingId: null,
        errorCode: null, resultMessageId: null, createdAt: NOW, updatedAt: NOW, ...data,
      })),
    },
  };
  const quote = {
    quoteReschedule: jest.fn().mockResolvedValue({
      payload: {
        bookingId: 'booking-1', branchId: 'branch-1', employeeId: 'employee-1',
        serviceId: 'service-1', oldScheduledAt: '2026-08-14T09:00:00.000Z',
        newScheduledAt: NEW_START.toISOString(), newEndsAt: '2026-08-15T10:30:00.000Z',
        durationMins: 90, durationOptionId: 'duration-1', bookingType: 'INDIVIDUAL',
        deliveryType: DeliveryType.IN_PERSON, price: 20_000, currency: 'SAR',
      },
      summary: {
        action: 'RESCHEDULE_BOOKING', bookingId: 'booking-1',
        oldScheduledAt: '2026-08-14T09:00:00.000Z', newScheduledAt: NEW_START.toISOString(),
        endsAt: '2026-08-15T10:30:00.000Z', durationMins: 90,
      },
    }),
    quoteCancellation: jest.fn().mockResolvedValue({
      payload: {
        bookingId: 'booking-1', scheduledAt: '2026-08-14T09:00:00.000Z',
        durationMins: 90, status: 'CONFIRMED', deliveryType: DeliveryType.IN_PERSON,
      },
      summary: {
        action: 'CANCEL_BOOKING', bookingId: 'booking-1',
        scheduledAt: '2026-08-14T09:00:00.000Z', durationMins: 90,
      },
    }),
  };
  const rls = { withTransaction: jest.fn((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)) };
  return {
    prisma,
    quote,
    reschedule: new PrepareRescheduleHandler(prisma as never, rls as never, quote as unknown as ChatBookingQuoteService),
    cancellation: new PrepareCancellationHandler(prisma as never, rls as never, quote as unknown as ChatBookingQuoteService),
  };
}

describe('prepare owned booking actions', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
  afterEach(() => jest.useRealTimers());

  it.each(['reschedule', 'cancellation'] as const)(
    'creates AWAITING_AUTH for a guest %s without looking up the booking',
    async (kind) => {
      const harness = buildHarness(null);
      const operation = kind === 'reschedule'
        ? await harness.reschedule.execute({
            conversationId: 'conversation-1', clientId: null, sourceMessageId: 'message-1',
            bookingId: 'booking-forged', newScheduledAt: NEW_START.toISOString(),
          })
        : await harness.cancellation.execute({
            conversationId: 'conversation-1', clientId: null, sourceMessageId: 'message-1',
            bookingId: 'booking-forged',
          });

      expect(operation).toMatchObject({
        status: ChatOperationStatus.AWAITING_AUTH,
        requiredConfirmations: 0,
        confirmationCount: 0,
      });
      expect(harness.quote.quoteReschedule).not.toHaveBeenCalled();
      expect(harness.quote.quoteCancellation).not.toHaveBeenCalled();
    },
  );

  it('prepares a one-confirmation reschedule with the owned booking duration frozen in payload', async () => {
    const { reschedule, prisma } = buildHarness('client-1');

    const operation = await reschedule.execute({
      conversationId: 'conversation-1', clientId: 'client-1', sourceMessageId: 'message-1',
      bookingId: 'booking-1', newScheduledAt: NEW_START.toISOString(),
    });

    expect(operation).toMatchObject({
      type: ChatOperationType.RESCHEDULE_BOOKING,
      status: ChatOperationStatus.AWAITING_CONFIRMATION,
      requiredConfirmations: 1,
      confirmationCount: 0,
      payload: expect.objectContaining({ bookingId: 'booking-1', durationMins: 90 }),
    });
    expect(operation.payload).not.toHaveProperty('newDurationMins');
    expect(operation.expiresAt).toEqual(new Date('2026-08-13T09:15:00.000Z'));
    expect(prisma.chatOperation.create).toHaveBeenCalledTimes(1);
  });

  it('prepares a one-confirmation cancellation with only the immutable owned summary', async () => {
    const { cancellation } = buildHarness('client-1');

    const operation = await cancellation.execute({
      conversationId: 'conversation-1', clientId: 'client-1', sourceMessageId: 'message-1',
      bookingId: 'booking-1',
    });

    expect(operation).toMatchObject({
      type: ChatOperationType.CANCEL_BOOKING,
      status: ChatOperationStatus.AWAITING_CONFIRMATION,
      requiredConfirmations: 1,
      payload: expect.objectContaining({ bookingId: 'booking-1', status: 'CONFIRMED' }),
      summary: expect.objectContaining({ action: 'CANCEL_BOOKING' }),
    });
    expect(JSON.stringify(operation.payload)).not.toMatch(/clientId|phone|reason|cancelNotes/);
  });
});
