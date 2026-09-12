import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { CheckInBookingHandler } from './check-in-booking.handler';
import { buildPrisma, buildRlsTransaction, mockBooking } from '../testing/booking-test-helpers';

describe('CheckInBookingHandler', () => {
  it('sets checkedInAt on CONFIRMED booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });
    await new CheckInBookingHandler(prisma as never, buildRlsTransaction(prisma) as never).execute({ bookingId: 'book-1', changedBy: 'user-42' });
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ checkedInAt: expect.any(Date) }) }),
    );
  });

  it('throws BadRequestException when booking is not CONFIRMED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.COMPLETED });
    await expect(
      new CheckInBookingHandler(prisma as never, buildRlsTransaction(prisma) as never).execute({ bookingId: 'book-1', changedBy: 'user-42' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when already checked in', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED, checkedInAt: new Date() });
    await expect(
      new CheckInBookingHandler(prisma as never, buildRlsTransaction(prisma) as never).execute({ bookingId: 'book-1', changedBy: 'user-42' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when booking not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue(null);
    await expect(
      new CheckInBookingHandler(prisma as never, buildRlsTransaction(prisma) as never).execute({ bookingId: 'bad', changedBy: 'user-42' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('CheckInBookingHandler — package credit consumption', () => {
  it('consumes the reserved package session at check-in', async () => {
    const prisma = buildPrisma();
    const packageBooking = { ...mockBooking, status: BookingStatus.CONFIRMED, checkedInAt: null, packageCreditId: 'credit-1' };
    prisma.booking.findUnique.mockResolvedValue(packageBooking);

    await new CheckInBookingHandler(prisma as never, buildRlsTransaction(prisma) as never).execute({ bookingId: 'book-1', changedBy: 'user-42' });

    expect(prisma.packageCreditUsage.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { bookingId: 'book-1', status: 'RESERVED' } }),
    );
    expect(prisma.packageCredit.update).toHaveBeenCalledWith({
      where: { id: 'credit-1' },
      data: { reservedQuantity: { decrement: 1 }, usedQuantity: { increment: 1 } },
    });
  });

  it('does not touch the package credit when the booking was not package-funded', async () => {
    const prisma = buildPrisma();
    const paidBooking = { ...mockBooking, status: BookingStatus.CONFIRMED, checkedInAt: null, packageCreditId: null };
    prisma.booking.findUnique.mockResolvedValue(paidBooking);

    await new CheckInBookingHandler(prisma as never, buildRlsTransaction(prisma) as never).execute({ bookingId: 'book-1', changedBy: 'user-42' });

    expect(prisma.packageCreditUsage.findFirst).not.toHaveBeenCalled();
    expect(prisma.packageCredit.update).not.toHaveBeenCalled();
  });
});

describe('CheckInBookingHandler — status log', () => {
  it('writes a BookingStatusLog entry on check-in', async () => {
    const prisma = buildPrisma();
    const confirmedBooking = { ...mockBooking, status: BookingStatus.CONFIRMED, checkedInAt: null };
    prisma.booking.findUnique.mockResolvedValue(confirmedBooking);
    const handler = new CheckInBookingHandler(prisma as never, buildRlsTransaction(prisma) as never);

    await handler.execute({ bookingId: 'book-1', changedBy: 'user-42' });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: BookingStatus.CONFIRMED,
        toStatus: BookingStatus.CONFIRMED,
        changedBy: 'user-42',
        reason: 'checked-in',
      }),
    });
  });
});
