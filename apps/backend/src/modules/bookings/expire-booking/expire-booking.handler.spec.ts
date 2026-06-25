import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus, RefundType } from '@prisma/client';
import { ExpireBookingHandler } from './expire-booking.handler';
import { buildPrisma, buildRlsTransaction, buildEventBus, mockBooking } from '../testing/booking-test-helpers';

const buildRefundHandler = () => ({
  createRefundRequestInTx: jest.fn(),
});

const buildGroupCapacity = () => ({
  decrementEnrollment: jest.fn().mockResolvedValue(undefined),
});

const newHandler = (
  prisma: ReturnType<typeof buildPrisma>,
  eventBus: ReturnType<typeof buildEventBus> = buildEventBus(),
  refundHandler: ReturnType<typeof buildRefundHandler> = buildRefundHandler(),
  groupCapacity: ReturnType<typeof buildGroupCapacity> = buildGroupCapacity(),
) =>
  new ExpireBookingHandler(
    prisma as never,
    buildRlsTransaction(prisma) as never,
    eventBus as never,
    refundHandler as never,
    groupCapacity as never,
  );

describe('ExpireBookingHandler', () => {
  it('expires PENDING booking', async () => {
    const prisma = buildPrisma();
    await newHandler(prisma).execute({ bookingId: 'book-1', changedBy: 'user-42' });
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.EXPIRED }) }),
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
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.EXPIRED }) }),
    );
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

    await newHandler(prisma, buildEventBus(), buildRefundHandler(), groupCapacity)
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

    await newHandler(prisma, buildEventBus(), buildRefundHandler(), groupCapacity)
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
  it('creates a FULL refund request when a COMPLETED deposit payment exists', async () => {
    const prisma = buildPrisma();
    prisma.payment.findFirst = jest.fn().mockResolvedValue({ id: 'pay-1', amount: 10_000, refundedAmount: 0 });
    const refundHandler = buildRefundHandler();
    refundHandler.createRefundRequestInTx.mockResolvedValue({ refundRequestId: 'rr-1', idempotencyKey: 'ik-1' });

    await newHandler(prisma, buildEventBus(), refundHandler).execute({ bookingId: 'book-1', changedBy: 'system' });

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

  it('publishes BookingCancelledEvent carrying refundRequestId + idempotencyKey so the refund is finalized', async () => {
    const prisma = buildPrisma();
    prisma.payment.findFirst = jest.fn().mockResolvedValue({ id: 'pay-1', amount: 10_000, refundedAmount: 0 });
    const eventBus = buildEventBus();
    const refundHandler = buildRefundHandler();
    refundHandler.createRefundRequestInTx.mockResolvedValue({ refundRequestId: 'rr-1', idempotencyKey: 'ik-1' });

    await newHandler(prisma, eventBus, refundHandler).execute({ bookingId: 'book-1', changedBy: 'system' });

    expect(eventBus.publish).toHaveBeenCalledWith(
      'bookings.booking.cancelled',
      expect.objectContaining({
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
    );
  });

  it('does NOT create a refund request when there is no COMPLETED payment', async () => {
    const prisma = buildPrisma();
    prisma.payment.findFirst = jest.fn().mockResolvedValue(null);
    const refundHandler = buildRefundHandler();

    await newHandler(prisma, buildEventBus(), refundHandler).execute({ bookingId: 'book-1', changedBy: 'system' });

    expect(refundHandler.createRefundRequestInTx).not.toHaveBeenCalled();
  });
});
