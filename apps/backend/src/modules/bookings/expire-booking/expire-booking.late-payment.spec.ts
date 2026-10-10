import { BookingStatus } from '@prisma/client';
import { ExpireBookingHandler } from './expire-booking.handler';
import { MoyasarPaymentSettlementHandler } from '../../finance/moyasar-payment-settlement/moyasar-payment-settlement.handler';
import { OnBookingCancelledRefundHandler } from '../../finance/events/on-booking-cancelled.handler';

/** Stateful integration of the real settlement, expiry and refund event consumer.
 * Database/provider boundaries are mocked; PostgreSQL acceptance is separate. */
describe('captured elapsed hold → booking expiry', () => {
  function setup() {
    const booking: any = {
      id: 'booking',
      status: BookingStatus.AWAITING_PAYMENT,
      programId: 'program',
      expiresAt: new Date(0),
      isHistoricalImport: false,
      clientId: 'client',
      employeeId: 'employee',
      scheduledAt: new Date('2030-01-01'),
      bookingNumber: 1,
      packageCreditId: null,
    };
    const invoice: any = {
      id: 'invoice',
      bookingId: 'booking',
      clientId: 'client',
      total: 230,
      currency: 'SAR',
      status: 'ISSUED',
      issuedAt: null,
    };
    const payment: any = {
      id: 'payment',
      invoiceId: 'invoice',
      gatewayRef: 'payment',
      status: 'PENDING',
      amount: 230,
      currency: 'SAR',
      refundedAmount: 0,
    };
    const reviews: any[] = [];
    const outbox: any[] = [];
    const program = { enrolledCount: 1 };
    let enrollmentPresent = true;
    const prisma: any = {
      $queryRaw: jest.fn(),
      booking: {
        findFirst: jest.fn(async () => booking),
        findUnique: jest.fn(async () => booking),
        updateMany: jest.fn(async ({ where, data }: any) => {
          if (booking.status !== where.status) return { count: 0 };
          Object.assign(booking, data);
          return { count: 1 };
        }),
      },
      bookingStatusLog: { create: jest.fn() },
      invoice: {
        findFirst: jest.fn(async () => invoice),
        update: jest.fn(async ({ data }: any) => Object.assign(invoice, data)),
      },
      payment: {
        findFirst: jest.fn(async ({ where }: any) =>
          where.status && where.status !== payment.status ? null : payment,
        ),
        update: jest.fn(async ({ data }: any) => Object.assign(payment, data)),
        aggregate: jest.fn(async () => ({
          _sum: { amount: payment.status === 'COMPLETED' ? 230 : 0 },
        })),
      },
      service: { findFirst: jest.fn().mockResolvedValue(null) },
      refundRequest: {
        findUnique: jest.fn(
          async ({ where }: any) =>
            reviews.find((row) => row.sourceEventId === where.sourceEventId) ??
            null,
        ),
        findFirst: jest.fn(
          async ({ where }: any) =>
            reviews.find((row) =>
              Object.entries(where).every(([key, value]) => row[key] === value),
            ) ?? null,
        ),
        create: jest.fn(async ({ data }: any) => {
          const row = { id: `review-${reviews.length + 1}`, ...data };
          reviews.push(row);
          return row;
        }),
      },
      outboxEvent: {
        create: jest.fn(async ({ data }: any) => {
          outbox.push(data);
          return data;
        }),
      },
      programEnrollment: {
        deleteMany: jest.fn(async () => {
          enrollmentPresent = false;
          return { count: 1 };
        }),
      },
    };
    const transactions = { withTransaction: async (fn: any) => fn(prisma) };
    const provider = {
      refund: jest.fn().mockResolvedValue({ status: 'refunded' }),
    };
    const refundHandler = {
      createRefundRequestInTx: jest.fn(async (_tx: any, command: any) => {
        const row = {
          id: `auto-${reviews.length + 1}`,
          paymentId: command.paymentId,
          status: 'PROCESSING',
          idempotencyKey: 'auto-key',
        };
        reviews.push(row);
        return { refundRequestId: row.id, idempotencyKey: row.idempotencyKey };
      }),
      finalizeRefundFromCancellation: jest.fn(async () => provider.refund()),
      execute: jest.fn(async () => provider.refund()),
    };
    const consumer = new OnBookingCancelledRefundHandler(
      { publish: jest.fn() } as never,
      refundHandler as never,
      {} as never,
    );
    // Stand-in for the outbox relay: deliver staged rows to the real consumer.
    const relayOutbox = async () => {
      for (const row of outbox.splice(0)) await consumer.handle(row.payload);
    };
    const capacity = {
      decrementEnrollment: jest.fn(async () => {
        program.enrolledCount -= 1;
      }),
    };
    const settle = new MoyasarPaymentSettlementHandler(
      prisma,
      transactions as never,
    );
    const expire = new ExpireBookingHandler(
      prisma,
      transactions as never,
      refundHandler as never,
      capacity as never,
    );
    return {
      booking,
      payment,
      invoice,
      reviews,
      program,
      prisma,
      provider,
      refundHandler,
      outbox,
      relayOutbox,
      settle,
      expire,
      enrollmentPresent: () => enrollmentPresent,
    };
  }

  it.each([null, 'program'])('expires the reservation with exactly one review and no automatic refund (programId=%s)', async (programId) => {
    const state = setup();
    state.booking.programId = programId;
    const result = await state.settle.execute({
      invoiceId: 'invoice',
      gatewayPaymentId: 'payment',
      gatewayRefs: ['payment'],
      requiredPaymentId: 'payment',
      fetched: {
        id: 'payment',
        status: 'paid',
        amount: 230,
        currency: 'SAR',
        refunded: 0,
      },
    });
    expect(result.requiresReview).toBe(true);
    expect(state.reviews).toHaveLength(1);
    expect(state.prisma.outboxEvent.create).not.toHaveBeenCalled();
    expect(state.payment.status).toBe('COMPLETED');
    await state.expire.execute({
      bookingId: 'booking',
      changedBy: 'expiry-worker',
    });
    expect(state.booking.status).toBe('EXPIRED');
    expect(state.program.enrolledCount).toBe(state.booking.programId ? 0 : 1);
    expect(state.enrollmentPresent()).toBe(!programId);
    expect(state.reviews).toHaveLength(1);
    expect(state.reviews[0].status).toBe('PENDING_REVIEW');
    expect(state.refundHandler.createRefundRequestInTx).not.toHaveBeenCalled();
    expect(state.provider.refund).not.toHaveBeenCalled();
    expect(state.outbox).toHaveLength(1);
    expect(state.outbox[0]).toEqual(
      expect.objectContaining({
        aggregateId: 'booking',
        eventType: 'bookings.booking.cancelled',
        payload: expect.objectContaining({
          payload: expect.objectContaining({
            refundType: 'NONE',
            refundRequestId: null,
            idempotencyKey: null,
          }),
        }),
      }),
    );
    // Relaying the staged event must not create a refund beside the review.
    await state.relayOutbox();
    expect(state.reviews).toHaveLength(1);
    expect(state.provider.refund).not.toHaveBeenCalled();
    // A repeated cron selection cannot decrement capacity or create another request.
    await expect(
      state.expire.execute({
        bookingId: 'booking',
        changedBy: 'expiry-worker',
      }),
    ).rejects.toThrow();
    expect(state.program.enrolledCount).toBe(state.booking.programId ? 0 : 1);
    expect(state.reviews).toHaveLength(1);
  });

  it('preserves the normal automatic expiry refund when there is no late-payment review', async () => {
    const state = setup();
    state.payment.status = 'COMPLETED';
    state.invoice.status = 'PAID';
    await state.expire.execute({
      bookingId: 'booking',
      changedBy: 'expiry-worker',
    });
    expect(state.booking.status).toBe('EXPIRED');
    expect(state.program.enrolledCount).toBe(state.booking.programId ? 0 : 1);
    expect(state.reviews).toHaveLength(1);
    expect(state.refundHandler.createRefundRequestInTx).toHaveBeenCalledTimes(
      1,
    );
    expect(state.outbox).toHaveLength(1);
    expect(state.outbox[0]).toEqual(
      expect.objectContaining({
        aggregateId: 'booking',
        eventType: 'bookings.booking.cancelled',
        payload: expect.objectContaining({
          payload: expect.objectContaining({
            refundType: 'FULL',
            paymentId: 'payment',
            refundRequestId: state.reviews[0].id,
          }),
        }),
      }),
    );
    // Previously the refund was finalized by the direct publish; now by relaying
    // the staged outbox envelope to the same consumer.
    await state.relayOutbox();
    expect(state.provider.refund).toHaveBeenCalledTimes(1);
  });
});
