import * as cancellationPolicy from './client-cancellation-policy';
import { calculateClientCancellation } from './client-cancellation-policy';
import type { ClientCancelCommand } from './client-cancel-booking.handler';
import { BadRequestException, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { BookingStatus, DeliveryType } from '@prisma/client';
import { ClientCancelBookingHandler } from './client-cancel-booking.handler';
import { stableEventId } from '../../../common/events';
import { mockBooking, buildPrisma as basePrisma, buildRlsTransaction } from '../testing/booking-test-helpers';

const buildPrisma = () => {
  const db = basePrisma() as any;
  db.payment.findMany = jest.fn().mockResolvedValue([]);
  const raw = db.$queryRaw;
  db.$queryRaw = jest.fn((query: any, ...args: any[]) => raw(Array.isArray(query) ? query : query.strings, ...args));
  return db;
};

const buildGroupCapacity = () => ({ recalculateGroupStatus: jest.fn().mockResolvedValue(undefined) });

const futureBooking = {
  ...mockBooking,
  scheduledAt: new Date(Date.now() + 48 * 3_600_000),
  endsAt: new Date(Date.now() + 49 * 3_600_000),
};

const buildSettingsHandler = (overrides = {}) => ({
  execute: jest.fn().mockResolvedValue({
    freeCancelBeforeHours: 24,
    freeCancelRefundType: 'FULL',
    ...overrides,
  }),
});

const buildEventBus = () => ({ publish: jest.fn().mockResolvedValue(undefined) });
const buildRefundHandler = () => ({
  createRefundRequestInTx: jest.fn(),
  getRefundRequest: jest.fn(),
  callMoyasarAndFinalize: jest.fn(),
  finalizeRefund: jest.fn(),
});
const refundHandler = buildRefundHandler();

// Prepare explicit consent from the real preview calculation over each test's fixture.
const replayQuotes = new WeakMap<ClientCancelBookingHandler, Map<string, string>>();
async function executeConsented(handler: ClientCancelBookingHandler, command: Omit<ClientCancelCommand, 'acceptedRefundTerms' | 'quoteToken'> & Partial<Pick<ClientCancelCommand, 'acceptedRefundTerms' | 'quoteToken'>>) {
  const fixture = async (tx: any) => {
    const booking = await tx.booking.findUnique({ where: { id: command.bookingId } });
    if (!booking) return 'a'.repeat(64);
    const settings = await handler['settingsHandler'].execute({ branchId: booking.branchId, transaction: tx });
    const payments = await tx.payment.findMany();
    return calculateClientCancellation(booking, settings, payments, new Date(), command.legacyChannel).quoteToken;
  };
  const prior = command.sourceActionId && replayQuotes.get(handler)?.get(command.sourceActionId);
  const quoteToken = command.quoteToken ?? (prior || await (command.transaction ? fixture(command.transaction) : handler['rlsTransaction'].withTransaction(fixture)));
  if (command.sourceActionId) {
    if (!replayQuotes.has(handler)) replayQuotes.set(handler, new Map());
    replayQuotes.get(handler)!.set(command.sourceActionId, quoteToken);
  }
  return handler.execute({ acceptedRefundTerms: true, ...command, quoteToken });
}

describe('ClientCancelBookingHandler', () => {
  it.each([
    {}, { acceptedRefundTerms: false, quoteToken: 'a'.repeat(64) },
    { acceptedRefundTerms: null, quoteToken: 'a'.repeat(64) },
    { acceptedRefundTerms: true }, { acceptedRefundTerms: true, quoteToken: '' },
    { acceptedRefundTerms: true, quoteToken: 'malformed' },
  ])('rejects missing or invalid explicit consent before any effect: %p', async consent => {
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue(futureBooking);
    const handler = new ClientCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildSettingsHandler() as never, buildEventBus() as never, refundHandler as never, buildGroupCapacity() as never);
    await expect(handler.execute({ bookingId: 'book-1', clientId: 'client-1', ...consent } as never)).rejects.toThrow(BadRequestException);
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(prisma.bookingStatusLog.create).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('cancels a PENDING booking with >24h notice → CANCELLED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue(futureBooking);
    const settings = buildSettingsHandler();
    const handler = new ClientCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, settings as never, buildEventBus() as never, refundHandler as never, buildGroupCapacity() as never);

    const result = await executeConsented(handler, {
      bookingId: 'book-1',
      clientId: 'client-1',
      reason: 'Changed my mind',
    });

    expect(result.status).toBe('CANCELLED');
    expect(result.requiresApproval).toBe(false);
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'book-1', status: BookingStatus.PENDING }),
        data: expect.objectContaining({
          status: BookingStatus.CANCELLED,
          cancelReason: 'CLIENT_REQUESTED',
          cancelledAt: expect.any(Date),
        }),
      }),
    );
    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: 'book-1',
        fromStatus: BookingStatus.PENDING,
        toStatus: BookingStatus.CANCELLED,
        changedBy: 'client-1',
        reason: 'Changed my mind',
      }),
    });
  });

  it('outside free cancel window → CANCEL_REQUESTED (requires approval)', async () => {
    const soonBooking = {
      ...mockBooking,
      status: BookingStatus.CONFIRMED,
      scheduledAt: new Date(Date.now() + 12 * 3_600_000),
      endsAt: new Date(Date.now() + 13 * 3_600_000),
    };
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue(soonBooking);
    const settings = buildSettingsHandler({ freeCancelBeforeHours: 24 });
    const handler = new ClientCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, settings as never, buildEventBus() as never, refundHandler as never, buildGroupCapacity() as never);

    const result = await executeConsented(handler, {
      bookingId: 'book-1',
      clientId: 'client-1',
    });

    expect(result.status).toBe('CANCEL_REQUESTED');
    expect(result.requiresApproval).toBe(true);
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: BookingStatus.CANCEL_REQUESTED }),
      }),
    );
  });

  it('does not commit a client cancellation while an ONLINE reschedule sync lease is active', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue({ ...futureBooking, deliveryType: DeliveryType.ONLINE });
    const handler = new ClientCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildSettingsHandler() as never, buildEventBus() as never, refundHandler as never, buildGroupCapacity() as never);
    await executeConsented(handler, { bookingId: 'book-1', clientId: 'client-1' });
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        AND: expect.arrayContaining([expect.objectContaining({
          OR: expect.arrayContaining([expect.objectContaining({ zoomSyncLeaseOwner: null })]),
        })]),
      }),
    }));
  });

  it('fails atomically without status log when the active sync lease makes the cancellation CAS lose', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue({ ...futureBooking, deliveryType: DeliveryType.ONLINE });
    prisma.booking.updateMany.mockResolvedValue({ count: 0 });
    const handler = new ClientCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildSettingsHandler() as never, buildEventBus() as never, refundHandler as never, buildGroupCapacity() as never);
    await expect(executeConsented(handler, { bookingId: 'book-1', clientId: 'client-1' })).rejects.toThrow('status changed concurrently');
    expect(prisma.bookingStatusLog.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when booking does not exist', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue(null);
    const handler = new ClientCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildSettingsHandler() as never, buildEventBus() as never, refundHandler as never, buildGroupCapacity() as never);

    await expect(
      executeConsented(handler, { bookingId: 'bad-id', clientId: 'client-1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when client does not own the booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue(futureBooking);
    const handler = new ClientCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildSettingsHandler() as never, buildEventBus() as never, refundHandler as never, buildGroupCapacity() as never);

    await expect(
      executeConsented(handler, { bookingId: 'book-1', clientId: 'other-client' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws BadRequestException when booking status is not cancellable', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue({
      ...futureBooking,
      status: BookingStatus.COMPLETED,
    });
    const handler = new ClientCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildSettingsHandler() as never, buildEventBus() as never, refundHandler as never, buildGroupCapacity() as never);

    await expect(
      executeConsented(handler, { bookingId: 'book-1', clientId: 'client-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows cancelling AWAITING_PAYMENT booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue({
      ...futureBooking,
      status: BookingStatus.AWAITING_PAYMENT,
    });
    const handler = new ClientCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildSettingsHandler() as never, buildEventBus() as never, refundHandler as never, buildGroupCapacity() as never);

    const result = await executeConsented(handler, { bookingId: 'book-1', clientId: 'client-1' });

    expect(result.status).toBe('CANCELLED');
  });

  // ─── Session-package credit return (P1-1 fix) ───────────────────────────

  it('returns session-package credit on direct-cancel of a credit booking', async () => {
    const creditBooking = { ...futureBooking, packageCreditId: 'credit-1' };
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue(creditBooking);
    const handler = new ClientCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildSettingsHandler() as never, buildEventBus() as never, refundHandler as never, buildGroupCapacity() as never);

    const result = await executeConsented(handler, { bookingId: 'book-1', clientId: 'client-1' });

    expect(result.status).toBe('CANCELLED');
    expect(prisma.packageCreditUsage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'usage-1' },
        data: expect.objectContaining({ status: 'RETURNED' }),
      }),
    );
    expect(prisma.packageCredit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'credit-1' },
        data: expect.objectContaining({ usedQuantity: { decrement: 1 } }),
      }),
    );
  });

  it('does NOT return credit on CANCEL_REQUESTED paths (credit stays consumed until approval)', async () => {
    // 12h in the future + 24h free-cancel window → falls into the "outside
    // free cancel window" branch which routes to CANCEL_REQUESTED.
    const soonCreditBooking = {
      ...futureBooking,
      status: BookingStatus.CONFIRMED,
      scheduledAt: new Date(Date.now() + 12 * 3_600_000),
      endsAt: new Date(Date.now() + 13 * 3_600_000),
      packageCreditId: 'credit-1',
    };
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue(soonCreditBooking);
    const handler = new ClientCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildSettingsHandler() as never, buildEventBus() as never, refundHandler as never, buildGroupCapacity() as never);

    const result = await executeConsented(handler, { bookingId: 'book-1', clientId: 'client-1' });

    expect(result.status).toBe('CANCEL_REQUESTED');
    expect(prisma.packageCreditUsage.update).not.toHaveBeenCalled();
    expect(prisma.packageCredit.update).not.toHaveBeenCalled();
  });

  it('joins a supplied transaction and durably records direct cancellation before any event delivery', async () => {
    const prisma = buildPrisma();
    const tx = buildPrisma();
    tx.booking.findUnique.mockResolvedValue(futureBooking);
    const rls = buildRlsTransaction(prisma);
    const eventBus = buildEventBus();
    const handler = new ClientCancelBookingHandler(
      prisma as never, rls as never, buildSettingsHandler() as never,
      eventBus as never, buildRefundHandler() as never, buildGroupCapacity() as never,
    );

    const result = await executeConsented(handler, {
      bookingId: 'book-1', clientId: 'client-1', reason: 'Changed',
      sourceActionId: '22222222-2222-4222-8222-222222222222', transaction: tx as never,
    });

    expect(result.status).toBe('CANCELLED');
    expect(rls.withTransaction).not.toHaveBeenCalled();
    expect(prisma.booking.findUnique).not.toHaveBeenCalled();
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.bookingStatusLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      sourceActionId: '22222222-2222-4222-8222-222222222222',
      sourceActionHash: expect.any(String),
      sourceActionResult: { kind: 'CANCELLATION', bookingId: 'book-1', status: 'CANCELLED', requiresApproval: false },
    }) });
    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: stableEventId('booking:book-1:client-cancel:22222222-2222-4222-8222-222222222222'),
      }),
    });
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('recovers a cancellation request by sourceActionId without another mutation or side effect', async () => {
    const tx = buildPrisma();
    const sourceActionId = '22222222-2222-4222-8222-222222222222';
    const eventBus = buildEventBus();
    const handler = new ClientCancelBookingHandler(
      buildPrisma() as never, buildRlsTransaction() as never,
      buildSettingsHandler({ requireCancelApproval: true }) as never,
      eventBus as never, buildRefundHandler() as never, buildGroupCapacity() as never,
    );

    await executeConsented(handler, { bookingId: 'book-1', clientId: 'client-1', sourceActionId, transaction: tx as never });
    const created = tx.bookingStatusLog.create.mock.calls[0][0].data;
    tx.bookingStatusLog.findUnique.mockResolvedValue(created);
    tx.booking.updateMany.mockClear();
    tx.bookingStatusLog.create.mockClear();

    const replay = await executeConsented(handler, {
      bookingId: 'book-1', clientId: 'client-1', sourceActionId, transaction: tx as never,
    });

    expect(replay.status).toBe('CANCEL_REQUESTED');
    expect(replay.requiresApproval).toBe(true);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
    expect(tx.bookingStatusLog.create).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('recovers a direct cancellation after the durable booking state is already terminal', async () => {
    const tx = buildPrisma();
    tx.booking.findUnique.mockResolvedValue(futureBooking);
    const sourceActionId = '22222222-2222-4222-8222-222222222222';
    const handler = new ClientCancelBookingHandler(
      buildPrisma() as never, buildRlsTransaction() as never,
      buildSettingsHandler() as never, buildEventBus() as never,
      buildRefundHandler() as never, buildGroupCapacity() as never,
    );

    await executeConsented(handler, { bookingId: 'book-1', clientId: 'client-1', sourceActionId, transaction: tx as never });
    const created = tx.bookingStatusLog.create.mock.calls[0][0].data;
    tx.bookingStatusLog.findUnique.mockResolvedValue(created);
    tx.booking.findUnique.mockResolvedValue({ ...futureBooking, status: BookingStatus.CANCELLED });
    tx.booking.updateMany.mockClear();
    tx.bookingStatusLog.create.mockClear();
    tx.outboxEvent.create.mockClear();

    const replay = await executeConsented(handler, {
      bookingId: 'book-1', clientId: 'client-1', sourceActionId, transaction: tx as never,
    });

    expect(replay.status).toBe('CANCELLED');
    expect(replay.booking.status).toBe(BookingStatus.CANCELLED);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
    expect(tx.bookingStatusLog.create).not.toHaveBeenCalled();
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('rejects reuse of a cancellation sourceActionId with different immutable input', async () => {
    const tx = buildPrisma();
    tx.bookingStatusLog.findUnique.mockResolvedValue({
      sourceActionId: '22222222-2222-4222-8222-222222222222',
      sourceActionHash: 'different',
      sourceActionResult: { kind: 'CANCELLATION', bookingId: 'book-1', status: 'CANCELLED', requiresApproval: false },
    });
    const handler = new ClientCancelBookingHandler(
      buildPrisma() as never, buildRlsTransaction() as never,
      buildSettingsHandler() as never, buildEventBus() as never,
      buildRefundHandler() as never, buildGroupCapacity() as never,
    );

    await expect(executeConsented(handler, {
      bookingId: 'book-1', clientId: 'client-1', reason: 'other',
      sourceActionId: '22222222-2222-4222-8222-222222222222', transaction: tx as never,
    })).rejects.toThrow(ConflictException);
  });
});

describe('enabled client cancellation policy', () => {
  const policy = { clientCancellationPolicyEnabled: true, clientCancelCutoffMode: 'BEFORE_START', clientCancelBeforeHours: 0, earlyCancelRefundPercent: 50, freeCancelBeforeHours: 24, freeCancelRefundType: 'PARTIAL', lateCancelRefundPercent: 25, autoRefundOnCancel: true, requireCancelApproval: true };
  const payment = { id: 'p1', invoiceId: 'i1', amount: 10000, refundedAmount: 0, status: 'COMPLETED', method: 'ONLINE_CARD', gatewayRef: 'g1', currency: 'SAR', refundRequests: [] };
  function setup(overrides = {}) {
    const db = buildPrisma() as any;
    const booking = { ...futureBooking, checkedInAt: null, isHistoricalImport: false, packageCreditId: null, currency: 'SAR', ...overrides };
    db.booking.findUnique.mockResolvedValue(booking);
    db.payment.findMany = jest.fn().mockResolvedValue([payment]);
    db.$queryRaw = jest.fn().mockResolvedValue([]);
    db.outboxEvent.create.mockResolvedValue({});
    const refunds = buildRefundHandler();
    refunds.createRefundRequestInTx.mockRejectedValue(new Error('provider unavailable'));
    const handler = new ClientCancelBookingHandler(db, buildRlsTransaction(db) as never, buildSettingsHandler(policy) as never, buildEventBus() as never, refunds as never, buildGroupCapacity() as never);
    return { db, handler, refunds, booking };
  }
  it.each([{}, { acceptedRefundTerms: false, quoteToken: 'a'.repeat(64) }, { acceptedRefundTerms: null, quoteToken: 'a'.repeat(64) }, { acceptedRefundTerms: true }, { acceptedRefundTerms: true, quoteToken: '' }])('fails closed on enabled-policy consent %p', async consent => {
    const { handler, db } = setup();
    await expect(handler.execute({ bookingId: 'book-1', clientId: 'client-1', ...consent } as never)).rejects.toThrow(BadRequestException);
    expect(db.booking.updateMany).not.toHaveBeenCalled();
    expect(db.outboxEvent.create).not.toHaveBeenCalled();
  });
  it.each(['payment', 'policy'])('rejects a valid token after enabled-policy %s changes', async change => {
    const { handler, db, booking } = setup();
    const originalSettings = await handler['settingsHandler'].execute({ branchId: booking.branchId });
    const quoteToken = calculateClientCancellation(booking, originalSettings, [payment]).quoteToken;
    if (change === 'payment') db.payment.findMany.mockResolvedValue([{ ...payment, refundRequests: [{ id: 'r1', amount: 1000, status: 'PENDING_REVIEW' }] }]);
    else (handler['settingsHandler'].execute as jest.Mock).mockResolvedValue({ ...originalSettings, earlyCancelRefundPercent: 20 });
    await expect(handler.execute({ bookingId: 'book-1', clientId: 'client-1', acceptedRefundTerms: true, quoteToken })).rejects.toThrow(ConflictException);
    expect(db.booking.updateMany).not.toHaveBeenCalled();
    expect(db.outboxEvent.create).not.toHaveBeenCalled();
  });
  it('cancels immediately despite old approval flag, persisting financial intent without calling finance', async () => {
    const { handler, db, refunds } = setup({ status: BookingStatus.DEPOSIT_PAID });
    const result = await executeConsented(handler, { bookingId: 'book-1', clientId: 'client-1' });
    expect(result).toMatchObject({ status: 'CANCELLED', requiresApproval: false, refund: { refundAmount: 5000, status: 'PROCESSING' } });
    expect(refunds.createRefundRequestInTx).not.toHaveBeenCalled();
    expect(db.outboxEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ payload: expect.objectContaining({ payload: expect.objectContaining({ clientCancellation: expect.objectContaining({ allocations: [expect.objectContaining({ paymentId: 'p1', amount: 5000 })] }) }) }) }) });
  });
  it('persists the original refund outcome for idempotent retries without another event', async () => {
    const { handler, db, booking } = setup();
    const action = '33333333-3333-4333-8333-333333333333';
    const first = await executeConsented(handler, { bookingId: 'book-1', clientId: 'client-1', sourceActionId: action });
    const saved = db.bookingStatusLog.create.mock.calls[0][0].data;
    db.booking.findUnique.mockResolvedValue({ ...booking, status: 'CANCELLED' });
    db.bookingStatusLog.findUnique.mockResolvedValue(saved);
    const second = await executeConsented(handler, { bookingId: 'book-1', clientId: 'client-1', sourceActionId: action });
    expect(second.refund).toEqual(first.refund);
    expect(db.booking.updateMany).toHaveBeenCalledTimes(1);
    expect(db.outboxEvent.create).toHaveBeenCalledTimes(1);
  });
  it('returns a reserved package credit once and never queues a cash refund', async () => {
    const { handler, db } = setup({ packageCreditId: 'credit-1' });
    db.payment.findMany.mockResolvedValue([]);
    db.packageCreditUsage.findFirst.mockResolvedValue({ id: 'usage-1', creditId: 'credit-1', status: 'RESERVED' });
    db.packageCredit.findUnique.mockResolvedValue({ purchaseId: 'purchase-1' });
    db.$queryRaw.mockResolvedValue([{ id: 'purchase-1', status: 'ACTIVE' }]);
    const result = await executeConsented(handler, { bookingId: 'book-1', clientId: 'client-1' });
    expect(result.refund).toMatchObject({ status: 'CREDIT_RETURNED', refundAmount: 0, execution: 'NONE' });
    expect(db.packageCredit.update).toHaveBeenCalledWith({ where: { id: 'credit-1' }, data: { reservedQuantity: { decrement: 1 } } });
    expect(db.outboxEvent.create.mock.calls[0][0].data.payload.payload.clientCancellation.allocations).toEqual([]);
  });
  it('rejects a changed preview token before mutating', async () => {
    const { handler, db } = setup();
    await expect(executeConsented(handler, { bookingId: 'book-1', clientId: 'client-1', quoteToken: 'f'.repeat(64) } as never)).rejects.toThrow(ConflictException);
    expect(db.booking.updateMany).not.toHaveBeenCalled();
  });
  it.each([{ checkedInAt: new Date() }, { status: BookingStatus.CANCEL_REQUESTED }])('rejects attendance and existing approval requests %p', async changes => {
    const { handler, db } = setup(changes);
    await expect(executeConsented(handler, { bookingId: 'book-1', clientId: 'client-1' })).rejects.toThrow();
    expect(db.outboxEvent.create).not.toHaveBeenCalled();
  });
  it('guards attendance and schedule at the actual mutation and loses a concurrent race', async () => {
    const { handler, db, booking } = setup();
    db.booking.updateMany.mockResolvedValue({ count: 0 });
    await expect(executeConsented(handler, { bookingId: 'book-1', clientId: 'client-1' })).rejects.toThrow();
    expect(db.booking.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ checkedInAt: null, scheduledAt: booking.scheduledAt, endsAt: booking.endsAt }) }));
    expect(db.outboxEvent.create).not.toHaveBeenCalled();
  });
});

describe('legacy consent and financial compatibility', () => {
  const captured = { id: 'p1', invoiceId: 'i1', amount: 10000, refundedAmount: 0, status: 'COMPLETED', method: 'ONLINE_CARD', gatewayRef: 'g1', currency: 'SAR', refundRequests: [] };
  function setup(channel: 'PUBLIC' | 'MOBILE', status = 'CONFIRMED') {
    const db = buildPrisma();
    const booking = { ...futureBooking, status, scheduledAt: new Date(Date.now() + 3600000), endsAt: new Date(Date.now() + 7200000) };
    const settings = { clientCancellationPolicyEnabled: false, requireCancelApproval: false, freeCancelBeforeHours: 24, freeCancelRefundType: 'PARTIAL', lateCancelRefundPercent: 25 };
    db.booking.findUnique.mockResolvedValue(booking);
    db.payment.findMany.mockResolvedValue([captured]);
    const settingsHandler = { execute: jest.fn().mockResolvedValue(settings) };
    const refunds = buildRefundHandler();
    refunds.createRefundRequestInTx.mockResolvedValue({ refundRequestId: 'r1', idempotencyKey: 'key' });
    const handler = new ClientCancelBookingHandler(db as never, buildRlsTransaction(db) as never, settingsHandler as never, buildEventBus() as never, refunds as never, buildGroupCapacity() as never);
    const command = { bookingId: 'book-1', clientId: 'client-1', legacyChannel: channel, acceptedRefundTerms: true as const, quoteToken: calculateClientCancellation(booking as never, settings, [captured], new Date(), channel).quoteToken };
    return { handler, db, refunds, command, booking, settingsHandler, settings };
  }
  it.each(['PUBLIC', 'MOBILE'] as const)('executes the accepted full refund when the clock crosses the legacy boundary after %s quote validation', async channel => {
    const beforeBoundary = new Date('2030-01-01T10:00:00.000Z');
    jest.useFakeTimers().setSystemTime(beforeBoundary);
    let calculateSpy: jest.SpyInstance | undefined;
    try {
      const { handler, db, refunds, command, booking, settings } = setup(channel);
      booking.scheduledAt = new Date(beforeBoundary.getTime() + 24 * 3600000 + 1);
      booking.endsAt = new Date(booking.scheduledAt.getTime() + 3600000);
      settings.freeCancelRefundType = 'FULL';
      const accepted = calculateClientCancellation(booking as never, settings, [captured], beforeBoundary, channel);
      expect(accepted.refund).toMatchObject({ refundAmount: 10000, refundPercent: 100, window: 'EARLY' });
      command.quoteToken = accepted.quoteToken;
      const calculate = cancellationPolicy.calculateClientCancellation;
      let validations = 0;
      calculateSpy = jest.spyOn(cancellationPolicy, 'calculateClientCancellation').mockImplementation((...args) => {
        const quote = calculate(...args);
        // Advance only after both actual quote checks have evaluated EARLY.
        if (++validations === 2) jest.setSystemTime(beforeBoundary.getTime() + 2);
        return quote;
      });
      expect(await handler.execute(command)).toMatchObject({ status: 'CANCELLED' });
      expect(refunds.createRefundRequestInTx).toHaveBeenCalledWith(db, expect.objectContaining({ paymentId: 'p1', amount: undefined }));
      expect(db.outboxEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ payload: expect.objectContaining({ payload: expect.objectContaining({ refundType: 'FULL' }) }) }) });
    } finally {
      calculateSpy?.mockRestore();
      jest.useRealTimers();
    }
  });
  it('preserves public late approval without starting a refund', async () => {
    const { handler, refunds, command } = setup('PUBLIC');
    expect(await handler.execute(command)).toMatchObject({ status: 'CANCEL_REQUESTED', requiresApproval: true });
    expect(refunds.createRefundRequestInTx).not.toHaveBeenCalled();
  });
  it('preserves mobile late direct partial refund and reason/notes', async () => {
    const { handler, db, refunds, command } = setup('MOBILE');
    expect(await handler.execute({ ...command, cancellationReason: 'OTHER', reason: 'Plans changed' })).toMatchObject({ status: 'CANCELLED', requiresApproval: false });
    expect(refunds.createRefundRequestInTx).toHaveBeenCalledWith(db, expect.objectContaining({ paymentId: 'p1', amount: 2500 }));
    expect(db.booking.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ cancelReason: 'OTHER', cancelNotes: 'Plans changed' }) }));
  });
  it('preserves mobile payment-hold FULL refund regardless of the late percentage', async () => {
    const { handler, db, refunds, command } = setup('MOBILE', 'AWAITING_PAYMENT');
    expect(await handler.execute(command)).toMatchObject({ status: 'CANCELLED' });
    expect(refunds.createRefundRequestInTx).toHaveBeenCalledWith(db, expect.objectContaining({ paymentId: 'p1', amount: undefined }));
  });
  it.each(['payment', 'policy', 'channel'])('rejects changed %s terms before any mutation', async change => {
    const { handler, db, refunds, command, settingsHandler, settings } = setup('MOBILE');
    if (change === 'payment') db.payment.findMany.mockResolvedValue([{ ...captured, amount: 20000 }]);
    if (change === 'policy') settingsHandler.execute.mockResolvedValue({ ...settings, requireCancelApproval: true });
    if (change === 'channel') command.legacyChannel = 'PUBLIC';
    await expect(handler.execute(command)).rejects.toThrow(ConflictException);
    expect(db.booking.updateMany).not.toHaveBeenCalled();
    expect(db.outboxEvent.create).not.toHaveBeenCalled();
    expect(refunds.createRefundRequestInTx).not.toHaveBeenCalled();
  });
});
