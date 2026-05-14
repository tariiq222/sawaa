import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { NoShowBookingHandler } from './no-show-booking.handler';
import { buildPrisma, mockBooking } from '../testing/booking-test-helpers';

describe('NoShowBookingHandler', () => {
  it('marks CONFIRMED booking as NO_SHOW', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });
    await new NoShowBookingHandler(prisma as never).execute({ bookingId: 'book-1', changedBy: 'user-42' });
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.NO_SHOW }) }),
    );
  });

  it('throws BadRequestException when booking is not CONFIRMED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.COMPLETED });
    await expect(
      new NoShowBookingHandler(prisma as never).execute({ bookingId: 'book-1', changedBy: 'user-42' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue(null);
    await expect(
      new NoShowBookingHandler(prisma as never).execute({ bookingId: 'bad', changedBy: 'user-42' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('NoShowBookingHandler — status log', () => {
  it('writes a BookingStatusLog entry on no-show', async () => {
    const prisma = buildPrisma();
    const confirmedBooking = { ...mockBooking, status: BookingStatus.CONFIRMED };
    prisma.booking.findUnique.mockResolvedValue(confirmedBooking);
    const handler = new NoShowBookingHandler(prisma as never);

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
