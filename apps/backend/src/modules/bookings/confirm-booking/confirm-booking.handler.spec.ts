import { BadRequestException } from '@nestjs/common';
import { BookingStatus, DeliveryType } from '@prisma/client';
import { ConfirmBookingHandler } from './confirm-booking.handler';
import { buildPrisma, buildRlsTransaction, buildEventBus, buildZoomHandler, mockBooking } from '../testing/booking-test-helpers';

describe('ConfirmBookingHandler', () => {
  it('confirms PENDING booking and emits BookingConfirmedEvent', async () => {
    const prisma = buildPrisma();
    const eb = buildEventBus();
    await new ConfirmBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, eb as never, buildZoomHandler() as never).execute({
      bookingId: 'book-1', changedBy: 'user-42',
    });
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.CONFIRMED }) }),
    );
    expect(eb.publish).toHaveBeenCalledWith('bookings.booking.confirmed', expect.anything());
  });

  it('creates a Zoom meeting when the delivery type is online', async () => {
    const prisma = buildPrisma();
    const zoom = buildZoomHandler();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, deliveryType: DeliveryType.ONLINE });

    await new ConfirmBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildEventBus() as never, zoom as never).execute({
      bookingId: 'book-1', changedBy: 'user-42',
    });

    expect(zoom.execute).toHaveBeenCalledWith({ bookingId: 'book-1' });
  });

  it('throws BadRequestException when booking is already CONFIRMED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });
    await expect(
      new ConfirmBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildEventBus() as never, buildZoomHandler() as never).execute({
        bookingId: 'book-1', changedBy: 'user-42',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('ConfirmBookingHandler — status log', () => {
  it('writes a BookingStatusLog entry on confirm', async () => {
    const prisma = buildPrisma();
    const eventBus = { publish: jest.fn() };
    const handler = new ConfirmBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, eventBus as never, buildZoomHandler() as never);

    await handler.execute({ bookingId: 'book-1', changedBy: 'user-42' });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: 'book-1',
        fromStatus: BookingStatus.PENDING,
        toStatus: BookingStatus.CONFIRMED,
        changedBy: 'user-42',
      }),
    });
  });
});
