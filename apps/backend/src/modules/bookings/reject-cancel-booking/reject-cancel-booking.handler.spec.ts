import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { RejectCancelBookingHandler } from './reject-cancel-booking.handler';
import { buildPrisma, buildRlsTransaction, buildEventBus, mockBooking } from '../testing/booking-test-helpers';

const cancelRequestedBooking = { ...mockBooking, status: 'CANCEL_REQUESTED' as BookingStatus };

describe('RejectCancelBookingHandler', () => {
  it('restores the booking to the pre-request status recorded in the status log (CONFIRMED)', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.bookingStatusLog.findFirst = jest.fn().mockResolvedValue({ fromStatus: BookingStatus.CONFIRMED });
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CONFIRMED });
    const eb = buildEventBus();
    const handler = new RejectCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, eb as never);

    await handler.execute({ bookingId: 'book-1', rejectedBy: 'admin-1', rejectReason: 'No reason' });

    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.CONFIRMED }) }),
    );
    expect(eb.publish).toHaveBeenCalledWith('bookings.booking.cancel_rejected', expect.anything());
  });

  it('falls back to PENDING (never promotes to a paid slot) when no pre-request status is recorded', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.bookingStatusLog.findFirst = jest.fn().mockResolvedValue(null);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.PENDING });
    const handler = new RejectCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildEventBus() as never);

    await handler.execute({ bookingId: 'book-1', rejectedBy: 'admin-1', rejectReason: 'No reason' });

    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.PENDING }) }),
    );
  });

  it('throws NotFoundException when booking not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(null);
    await expect(
      new RejectCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildEventBus() as never).execute({
        bookingId: 'bad', rejectedBy: 'admin-1', rejectReason: 'x',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when status is not CANCEL_REQUESTED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.PENDING });
    await expect(
      new RejectCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildEventBus() as never).execute({
        bookingId: 'book-1', rejectedBy: 'admin-1', rejectReason: 'x',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('writes BookingStatusLog entry on rejection', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.bookingStatusLog.findFirst = jest.fn().mockResolvedValue({ fromStatus: BookingStatus.CONFIRMED });
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CONFIRMED });
    const handler = new RejectCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildEventBus() as never);

    await handler.execute({ bookingId: 'book-1', rejectedBy: 'admin-1', rejectReason: 'policy' });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: 'CANCEL_REQUESTED',
          toStatus: BookingStatus.CONFIRMED,
          changedBy: 'admin-1',
          reason: 'policy',
        }),
      }),
    );
  });
});
