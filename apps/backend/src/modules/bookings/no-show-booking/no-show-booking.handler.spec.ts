import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { NoShowBookingHandler } from './no-show-booking.handler';
import { buildPrisma, buildRlsTransaction, mockBooking } from '../testing/booking-test-helpers';

describe('NoShowBookingHandler', () => {
  it('marks CONFIRMED booking as NO_SHOW', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });
    await new NoShowBookingHandler(prisma as never, buildRlsTransaction(prisma) as never).execute({ bookingId: 'book-1', changedBy: 'user-42' });
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.NO_SHOW }) }),
    );
  });

  it('throws BadRequestException when booking is not CONFIRMED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.COMPLETED });
    await expect(
      new NoShowBookingHandler(prisma as never, buildRlsTransaction(prisma) as never).execute({ bookingId: 'book-1', changedBy: 'user-42' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue(null);
    await expect(
      new NoShowBookingHandler(prisma as never, buildRlsTransaction(prisma) as never).execute({ bookingId: 'bad', changedBy: 'user-42' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('NoShowBookingHandler — status log', () => {
  it('writes a BookingStatusLog entry on no-show', async () => {
    const prisma = buildPrisma();
    const confirmedBooking = { ...mockBooking, status: BookingStatus.CONFIRMED };
    prisma.booking.findUnique.mockResolvedValue(confirmedBooking);
    const handler = new NoShowBookingHandler(prisma as never, buildRlsTransaction(prisma) as never);

    await handler.execute({ bookingId: 'book-1', changedBy: 'system' });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: BookingStatus.CONFIRMED,
        toStatus: BookingStatus.NO_SHOW,
        changedBy: 'system',
      }),
    });
  });
});

describe('NoShowBookingHandler — financial consequence (forfeiture)', () => {
  it('does NOT create any refund request or mutate any payment — the session is forfeited', async () => {
    const prisma = buildPrisma();
    // Add spies so we can prove neither is ever invoked on a no-show.
    const refundCreate = jest.fn();
    const paymentUpdate = jest.fn();
    (prisma as unknown as Record<string, unknown>).refundRequest = { create: refundCreate };
    (prisma.payment as unknown as Record<string, unknown>).update = paymentUpdate;
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });
    const handler = new NoShowBookingHandler(prisma as never, buildRlsTransaction(prisma) as never);

    await handler.execute({ bookingId: 'book-1', changedBy: 'system' });

    // No refundRequest creation, no payment mutation: the paid amount is retained.
    expect(refundCreate).not.toHaveBeenCalled();
    expect(paymentUpdate).not.toHaveBeenCalled();
  });

  it('records the forfeiture in the status-log reason', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });
    const handler = new NoShowBookingHandler(prisma as never, buildRlsTransaction(prisma) as never);

    await handler.execute({ bookingId: 'book-1', changedBy: 'system' });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reason: expect.stringContaining('forfeited'),
      }),
    });
  });
});
