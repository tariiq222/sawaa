import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { ApproveCancelBookingHandler } from './approve-cancel-booking.handler';
import { buildPrisma, buildEventBus, mockBooking } from '../testing/booking-test-helpers';

const cancelRequestedBooking = {
  ...mockBooking,
  status: 'CANCEL_REQUESTED' as BookingStatus,
  branchId: 'branch-1',
  clientId: 'client-1',
  employeeId: 'emp-1',
};

const defaultSettings = {
  execute: jest.fn().mockResolvedValue({ autoRefundOnCancel: true }),
};

describe('ApproveCancelBookingHandler', () => {
  it('approves cancel request and sets status to CANCELLED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CANCELLED });
    const eb = buildEventBus();
    const handler = new ApproveCancelBookingHandler(prisma as never, eb as never, defaultSettings as never);

    const result = await handler.execute({
      bookingId: 'book-1',
      approvedBy: 'admin-1',
      approverNotes: 'Approved',
    });

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.CANCELLED }) }),
    );
    expect(eb.publish).toHaveBeenCalledWith('bookings.booking.cancel_approved', expect.anything());
    expect(result.autoRefund).toBe(true);
  });

  it('throws NotFoundException when booking not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new ApproveCancelBookingHandler(prisma as never, buildEventBus() as never, defaultSettings as never);

    await expect(
      handler.execute({ bookingId: 'bad', approvedBy: 'admin-1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when status is not CANCEL_REQUESTED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });
    const handler = new ApproveCancelBookingHandler(prisma as never, buildEventBus() as never, defaultSettings as never);

    await expect(
      handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('writes BookingStatusLog entry on approval', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CANCELLED });
    const handler = new ApproveCancelBookingHandler(prisma as never, buildEventBus() as never, defaultSettings as never);

    await handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1', approverNotes: 'ok' });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromStatus: 'CANCEL_REQUESTED',
          toStatus: BookingStatus.CANCELLED,
          changedBy: 'admin-1',
        }),
      }),
    );
  });

  it('defaults autoRefund to true when setting not present', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CANCELLED });
    const settingsNoRefund = { execute: jest.fn().mockResolvedValue({}) };
    const handler = new ApproveCancelBookingHandler(prisma as never, buildEventBus() as never, settingsNoRefund as never);

    const result = await handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1' });
    expect(result.autoRefund).toBe(true);
  });
});
