import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus, CancellationReason } from '@prisma/client';
import { RequestCancelBookingHandler } from './request-cancel-booking.handler';
import { buildPrisma, buildEventBus, mockBooking } from '../testing/booking-test-helpers';

describe('RequestCancelBookingHandler', () => {
  it('sets status to CANCEL_REQUESTED for PENDING booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.PENDING });
    prisma.booking.update = jest.fn().mockResolvedValue({ ...mockBooking, status: 'CANCEL_REQUESTED' as BookingStatus });
    const eb = buildEventBus();
    const handler = new RequestCancelBookingHandler(prisma as never, eb as never);

    await handler.execute({
      bookingId: 'book-1',
      reason: CancellationReason.CLIENT_REQUESTED, requestedBy: 'client-1',
    });

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CANCEL_REQUESTED' }) }),
    );
    expect(eb.publish).toHaveBeenCalledWith('bookings.booking.cancel_requested', expect.anything());
  });

  it('sets status to CANCEL_REQUESTED for CONFIRMED booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });
    prisma.booking.update = jest.fn().mockResolvedValue({ ...mockBooking, status: 'CANCEL_REQUESTED' as BookingStatus });
    const handler = new RequestCancelBookingHandler(prisma as never, buildEventBus() as never);

    await handler.execute({
      bookingId: 'book-1',
      reason: CancellationReason.CLIENT_REQUESTED, requestedBy: 'client-1',
    });

    expect(prisma.booking.update).toHaveBeenCalled();
  });

  it('throws NotFoundException when booking not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(null);
    await expect(
      new RequestCancelBookingHandler(prisma as never, buildEventBus() as never).execute({
        bookingId: 'bad',
        reason: CancellationReason.OTHER, requestedBy: 'u',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException for non-cancellable status', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.COMPLETED });
    await expect(
      new RequestCancelBookingHandler(prisma as never, buildEventBus() as never).execute({
        bookingId: 'book-1',
        reason: CancellationReason.OTHER, requestedBy: 'u',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('saves cancelNotes when provided', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.PENDING });
    prisma.booking.update = jest.fn().mockResolvedValue({ ...mockBooking });
    const handler = new RequestCancelBookingHandler(prisma as never, buildEventBus() as never);

    await handler.execute({
      bookingId: 'book-1',
      reason: CancellationReason.OTHER, requestedBy: 'u', cancelNotes: 'urgent',
    });

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cancelNotes: 'urgent' }) }),
    );
  });
});
