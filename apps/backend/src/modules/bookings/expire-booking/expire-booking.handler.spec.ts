import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus, RefundType } from '@prisma/client';
import { ExpireBookingHandler } from './expire-booking.handler';
import { buildPrisma as buildBasePrisma, buildRlsTransaction, mockBooking as baseBooking } from '../testing/booking-test-helpers';

const mockBooking = { ...baseBooking, isHistoricalImport: false, expiresAt: new Date('2020-01-01') };
const buildPrisma = () => {
  const prisma = buildBasePrisma();
  prisma.booking.findUnique.mockResolvedValue(mockBooking);
  return prisma;
};

const buildRefundHandler = () => ({
  createRefundRequestInTx: jest.fn(),
});

const buildGroupCapacity = () => ({
  decrementEnrollment: jest.fn().mockResolvedValue(undefined),
});

const newHandler = (
  prisma: ReturnType<typeof buildPrisma>,
  refundHandler: ReturnType<typeof buildRefundHandler> = buildRefundHandler(),
  groupCapacity: ReturnType<typeof buildGroupCapacity> = buildGroupCapacity(),
) =>
  new ExpireBookingHandler(
    prisma as never,
    buildRlsTransaction(prisma) as never,
    refundHandler as never,
    groupCapacity as never,
  );

describe('ExpireBookingHandler', () => {
  it('expires PENDING booking', async () => {
    const prisma = buildPrisma();
    await newHandler(prisma).execute({ bookingId: 'book-1', changedBy: 'user-42' });
    // Status write goes through the guarded helper (updateMany where status=current).
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'book-1', status: BookingStatus.PENDING }),
        data: expect.objectContaining({ status: BookingStatus.EXPIRED }),
      }),
    );
  });

  it('throws BadRequestException when booking is not PENDING', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });
    await expect(
      newHandler(prisma).execute({ bookingId: 'book-1', changedBy: 'user-42' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue(null);
    await expect(
      newHandler(prisma).execute({ bookingId: 'bad', changedBy: 'user-42' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('ExpireBookingHandler — group booking statuses', () => {
  it('expires AWAITING_PAYMENT booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.AWAITING_PAYMENT });
    await newHandler(prisma).execute({ bookingId: 'book-1', changedBy: 'system' });
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'book-1', status: BookingStatus.AWAITING_PAYMENT }),
        data: expect.objectContaining({ status: BookingStatus.EXPIRED }),
      }),
    );
  });
});

describe('ExpireBookingHandler — concurrent-status guard', () => {
  it('bails (BadRequestException) when the booking is no longer in an expirable status', async () => {
    const prisma = buildPrisma();
    // fetchBookingOrFail still sees an expirable status...
    prisma.booking.findUnique = jest
      .fn()
      .mockResolvedValue({ ...mockBooking, status: BookingStatus.AWAITING_PAYMENT });
    // ...but the guarded write finds 0 rows matching status=AWAITING_PAYMENT,
    // i.e. a concurrent PAYMENT_CONFIRMED flipped it. updateBookingAtomically
    // must reject instead of double-writing / double-refunding.
    prisma.booking.updateMany = jest.fn().mockResolvedValue({ count: 0 });

    await expect(
      newHandler(prisma).execute({ bookingId: 'book-1', changedBy: 'system' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('does NOT stage a refund/cancel event when the guarded write bails', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest
      .fn()
      .mockResolvedValue({ ...mockBooking, status: BookingStatus.AWAITING_PAYMENT });
    prisma.payment.findFirst = jest
      .fn()
      .mockResolvedValue({ id: 'pay-1', amount: 10_000, refundedAmount: 0 });
    prisma.booking.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const refundHandler = buildRefundHandler();

    await expect(
      newHandler(prisma, refundHandler).execute({ bookingId: 'book-1', changedBy: 'system' }),
    ).rejects.toThrow(BadRequestException);

    // The refund request is created inside the tx, after the guarded write; a
    // bail rolls the whole tx back and the cancel event never publishes.
    expect(refundHandler.createRefundRequestInTx).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
  });
});

describe('ExpireBookingHandler — session-package credit return', () => {
  it('returns the credit on expiry of a credit booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({
      ...mockBooking,
      status: BookingStatus.AWAITING_PAYMENT,
      packageCreditId: 'credit-1',
    });

    await newHandler(prisma).execute({ bookingId: 'book-1', changedBy: 'system' });

    expect((prisma as any).packageCreditUsage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'RETURNED' }) }),
    );
    expect((prisma as any).packageCredit.update).toHaveBeenCalledWith({
      where: { id: 'credit-1' },
      data: { usedQuantity: { decrement: 1 } },
    });
  });

  it('does NOT touch credit models for a non-credit booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({
      ...mockBooking,
      status: BookingStatus.AWAITING_PAYMENT,
      packageCreditId: null,
    });

    await newHandler(prisma).execute({ bookingId: 'book-1', changedBy: 'system' });

    expect((prisma as any).packageCreditUsage.findFirst).not.toHaveBeenCalled();
    expect((prisma as any).packageCredit.update).not.toHaveBeenCalled();
  });
});

describe('ExpireBookingHandler — program enrollment capacity', () => {
  it('decrements program enrollment with the tx and programId when expiring a program booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({
      ...mockBooking,
      status: BookingStatus.AWAITING_PAYMENT,
      programId: 'prog-1',
    });
    const groupCapacity = buildGroupCapacity();

    await newHandler(prisma, buildRefundHandler(), groupCapacity)
      .execute({ bookingId: 'book-1', changedBy: 'system' });

    // buildRlsTransaction passes `prisma` itself as the tx — asserting on it
    // proves the decrement runs inside the same transaction as the update.
    expect(groupCapacity.decrementEnrollment).toHaveBeenCalledTimes(1);
    expect(groupCapacity.decrementEnrollment).toHaveBeenCalledWith(prisma, 'prog-1');
  });

  it('does NOT decrement program enrollment when the booking has no programId', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({
      ...mockBooking,
      status: BookingStatus.AWAITING_PAYMENT,
      programId: null,
    });
    const groupCapacity = buildGroupCapacity();

    await newHandler(prisma, buildRefundHandler(), groupCapacity)
      .execute({ bookingId: 'book-1', changedBy: 'system' });

    expect(groupCapacity.decrementEnrollment).not.toHaveBeenCalled();
  });
});

describe('ExpireBookingHandler — status log', () => {
  it('writes a BookingStatusLog entry on expire', async () => {
    const prisma = buildPrisma();
    const handler = newHandler(prisma);

    await handler.execute({ bookingId: 'book-1', changedBy: 'system' });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: BookingStatus.PENDING,
        toStatus: BookingStatus.EXPIRED,
        changedBy: 'system',
      }),
    });
  });
});

describe('ExpireBookingHandler — deposit refund (MONEY-SAFETY P1)', () => {
  it('re-reads a payment after the booking CAS when it commits during expiry', async () => {
    const prisma = buildPrisma();
    // The payment lookup occurs after the expiry CAS inside the transaction.
    prisma.payment.findFirst = jest.fn().mockResolvedValue({ id: 'pay-late', amount: 10_000, refundedAmount: 0 });
    const refundHandler = buildRefundHandler();
    refundHandler.createRefundRequestInTx.mockResolvedValue({ refundRequestId: 'rr-late', idempotencyKey: 'ik-late' });

    await newHandler(prisma, refundHandler).execute({ bookingId: 'book-1', changedBy: 'system' });

    expect(refundHandler.createRefundRequestInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ paymentId: 'pay-late' }),
    );
  });

  it('creates a FULL refund request when a COMPLETED deposit payment exists', async () => {
    const prisma = buildPrisma();
    prisma.payment.findFirst = jest.fn().mockResolvedValue({ id: 'pay-1', amount: 10_000, refundedAmount: 0 });
    const refundHandler = buildRefundHandler();
    refundHandler.createRefundRequestInTx.mockResolvedValue({ refundRequestId: 'rr-1', idempotencyKey: 'ik-1' });

    await newHandler(prisma, refundHandler).execute({ bookingId: 'book-1', changedBy: 'system' });

    expect(refundHandler.createRefundRequestInTx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        paymentId: 'pay-1',
        reason: expect.stringContaining('book-1'),
        performedBy: 'system',
      }),
    );
    // FULL refund: amount omitted so the finance handler refunds the entire paid amount.
    const call = refundHandler.createRefundRequestInTx.mock.calls[0][1];
    expect(call.amount).toBeUndefined();
  });

  it('stages BookingCancelledEvent in the outbox (same tx) carrying refundRequestId + idempotencyKey', async () => {
    const prisma = buildPrisma();
    prisma.payment.findFirst = jest.fn().mockResolvedValue({ id: 'pay-1', amount: 10_000, refundedAmount: 0 });
    const refundHandler = buildRefundHandler();
    refundHandler.createRefundRequestInTx.mockResolvedValue({ refundRequestId: 'rr-1', idempotencyKey: 'ik-1' });

    await newHandler(prisma, refundHandler).execute({ bookingId: 'book-1', changedBy: 'system' });

    // buildRlsTransaction passes `prisma` itself as the tx, so this write is in-tx.
    expect(prisma.outboxEvent.create).toHaveBeenCalledTimes(1);
    expect(prisma.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: expect.any(String),
        aggregateId: 'book-1',
        eventType: 'bookings.booking.cancelled',
        payload: expect.objectContaining({
          source: 'bookings',
          version: 1,
          payload: expect.objectContaining({
            bookingId: 'book-1',
            refundType: RefundType.FULL,
            paymentId: 'pay-1',
            refundRequestId: 'rr-1',
            idempotencyKey: 'ik-1',
          }),
        }),
      }),
    });
  });

  it('does NOT stage the event when the transaction fails after the outbox write', async () => {
    const prisma = buildPrisma();
    const committed: unknown[] = [];
    prisma.outboxEvent.create.mockImplementation(async (args: unknown) => {
      committed.push(args);
      throw new Error('tx aborted');
    });

    await expect(
      newHandler(prisma).execute({ bookingId: 'book-1', changedBy: 'system' }),
    ).rejects.toThrow('tx aborted');

  });

  it('does NOT create a refund request when there is no COMPLETED payment', async () => {
    const prisma = buildPrisma();
    prisma.payment.findFirst = jest.fn().mockResolvedValue(null);
    const refundHandler = buildRefundHandler();

    await newHandler(prisma, refundHandler).execute({ bookingId: 'book-1', changedBy: 'system' });

    expect(refundHandler.createRefundRequestInTx).not.toHaveBeenCalled();
  });
});

describe('ExpireBookingHandler — explicit deadline safety', () => {
  it.each([
    ['old booking without deadline', { expiresAt: null, createdAt: new Date('2000-01-01') }],
    ['future deadline', { expiresAt: new Date('2100-01-01') }],
    ['historical record', { isHistoricalImport: true }],
    ['deposit-confirmed booking', { status: BookingStatus.DEPOSIT_PAID }],
  ])('leaves %s unchanged', async (_label, overrides) => {
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue({ ...mockBooking, ...overrides });
    await expect(newHandler(prisma).execute({ bookingId: 'book-1', changedBy: 'system' }))
      .rejects.toThrow(BadRequestException);
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(prisma.bookingStatusLog.create).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
  });

  it.each(['deadline extended', 'deadline removed', 'status changed', 'marked historical'])(
    'rejects stale selection when %s before mutation', async (change) => {
      const prisma = buildPrisma();
      const current = { ...mockBooking,
        ...(change === 'deadline extended' ? { expiresAt: new Date('2100-01-01') } : {}),
        ...(change === 'deadline removed' ? { expiresAt: null } : {}),
        ...(change === 'status changed' ? { status: BookingStatus.DEPOSIT_PAID } : {}),
        ...(change === 'marked historical' ? { isHistoricalImport: true } : {}),
      };
      prisma.booking.updateMany.mockImplementation(async ({ where }: any) => ({
        count: current.status === where.status &&
          (!where.expiresAt || (current.expiresAt !== null && current.expiresAt < where.expiresAt.lt)) &&
          (where.isHistoricalImport === undefined || current.isHistoricalImport === where.isHistoricalImport)
          ? 1 : 0,
      }));
      await expect(newHandler(prisma).execute({ bookingId: 'book-1', changedBy: 'system' }))
        .rejects.toThrow(BadRequestException);
      expect(prisma.outboxEvent.create).not.toHaveBeenCalled();
      expect(prisma.bookingStatusLog.create).not.toHaveBeenCalled();
    });
});
