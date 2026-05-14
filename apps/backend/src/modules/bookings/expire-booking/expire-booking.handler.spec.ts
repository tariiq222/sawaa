import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { ExpireBookingHandler } from './expire-booking.handler';
import { buildPrisma, mockBooking } from '../testing/booking-test-helpers';

describe('ExpireBookingHandler', () => {
  it('expires PENDING booking', async () => {
    const prisma = buildPrisma();
    await new ExpireBookingHandler(prisma as never).execute({ bookingId: 'book-1', changedBy: 'user-42' });
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.EXPIRED }) }),
    );
  });

  it('throws BadRequestException when booking is not PENDING', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });
    await expect(
      new ExpireBookingHandler(prisma as never).execute({ bookingId: 'book-1', changedBy: 'user-42' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue(null);
    await expect(
      new ExpireBookingHandler(prisma as never).execute({ bookingId: 'bad', changedBy: 'user-42' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('ExpireBookingHandler — group booking statuses', () => {
  it('expires PENDING_GROUP_FILL booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.PENDING_GROUP_FILL });
    await new ExpireBookingHandler(prisma as never).execute({ bookingId: 'book-1', changedBy: 'system' });
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.EXPIRED }) }),
    );
  });

  it('expires AWAITING_PAYMENT booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.AWAITING_PAYMENT });
    await new ExpireBookingHandler(prisma as never).execute({ bookingId: 'book-1', changedBy: 'system' });
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.EXPIRED }) }),
    );
  });
});

describe('ExpireBookingHandler — status log', () => {
  it('writes a BookingStatusLog entry on expire', async () => {
    const prisma = buildPrisma();
    const handler = new ExpireBookingHandler(prisma as never);

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
