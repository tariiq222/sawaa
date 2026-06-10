import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { ApproveCancelBookingHandler } from './approve-cancel-booking.handler';
import { buildPrisma, buildRlsTransaction, buildEventBus, mockBooking } from '../testing/booking-test-helpers';

const buildGroupCapacity = () => ({ recalculateGroupStatus: jest.fn().mockResolvedValue(undefined) });

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
    const handler = new ApproveCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, eb as never, defaultSettings as never, buildGroupCapacity() as never);

    const result = await handler.execute({
      bookingId: 'book-1',
      approvedBy: 'admin-1',
      approverNotes: 'Approved',
    });

    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.CANCELLED }) }),
    );
    expect(eb.publish).toHaveBeenCalledWith('bookings.booking.cancel_approved', expect.anything());
    expect(result.autoRefund).toBe(true);
  });

  it('throws NotFoundException when booking not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(null);
    const handler = new ApproveCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildEventBus() as never, defaultSettings as never, buildGroupCapacity() as never);

    await expect(
      handler.execute({ bookingId: 'bad', approvedBy: 'admin-1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when status is not CANCEL_REQUESTED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });
    const handler = new ApproveCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildEventBus() as never, defaultSettings as never, buildGroupCapacity() as never);

    await expect(
      handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('writes BookingStatusLog entry on approval', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CANCELLED });
    const handler = new ApproveCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildEventBus() as never, defaultSettings as never, buildGroupCapacity() as never);

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

  it('propagates PARTIAL refund decision into event payload and status log reason', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CANCELLED });
    const eb = buildEventBus();
    const handler = new ApproveCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, eb as never, defaultSettings as never, buildGroupCapacity() as never);

    await handler.execute({
      bookingId: 'book-1',
      approvedBy: 'admin-1',
      approverNotes: 'client travelled',
      refundType: 'PARTIAL',
      refundAmount: 5000,
    });

    expect(eb.publish).toHaveBeenCalledWith(
      'bookings.booking.cancel_approved',
      expect.objectContaining({
        payload: expect.objectContaining({
          refundType: 'PARTIAL',
          refundAmount: 5000,
          approverNotes: 'client travelled',
        }),
      }),
    );
    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reason: 'Cancel request approved — refund: PARTIAL 5000 halalas — client travelled',
        }),
      }),
    );
  });

  it('propagates FULL refund decision without amount into event and status log', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CANCELLED });
    const eb = buildEventBus();
    const handler = new ApproveCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, eb as never, defaultSettings as never, buildGroupCapacity() as never);

    await handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1', refundType: 'FULL' });

    expect(eb.publish).toHaveBeenCalledWith(
      'bookings.booking.cancel_approved',
      expect.objectContaining({
        payload: expect.objectContaining({ refundType: 'FULL', refundAmount: undefined }),
      }),
    );
    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: 'Cancel request approved — refund: FULL' }),
      }),
    );
  });

  it('omits refund decision from event and status log when not provided', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CANCELLED });
    const eb = buildEventBus();
    const handler = new ApproveCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, eb as never, defaultSettings as never, buildGroupCapacity() as never);

    await handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1' });

    expect(eb.publish).toHaveBeenCalledWith(
      'bookings.booking.cancel_approved',
      expect.objectContaining({
        payload: expect.objectContaining({ refundType: undefined, refundAmount: undefined }),
      }),
    );
    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: 'Cancel request approved' }),
      }),
    );
  });

  it('throws BadRequestException when refundType is PARTIAL without refundAmount', async () => {
    const prisma = buildPrisma();
    const handler = new ApproveCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildEventBus() as never, defaultSettings as never, buildGroupCapacity() as never);

    await expect(
      handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1', refundType: 'PARTIAL' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when refundAmount is provided without PARTIAL refundType', async () => {
    const prisma = buildPrisma();
    const handler = new ApproveCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildEventBus() as never, defaultSettings as never, buildGroupCapacity() as never);

    await expect(
      handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1', refundType: 'FULL', refundAmount: 5000 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('defaults autoRefund to true when setting not present', async () => {
    const prisma = buildPrisma();
    prisma.booking.findFirst = jest.fn().mockResolvedValue(cancelRequestedBooking);
    prisma.booking.update = jest.fn().mockResolvedValue({ ...cancelRequestedBooking, status: BookingStatus.CANCELLED });
    const settingsNoRefund = { execute: jest.fn().mockResolvedValue({}) };
    const handler = new ApproveCancelBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildEventBus() as never, settingsNoRefund as never, buildGroupCapacity() as never);

    const result = await handler.execute({ bookingId: 'book-1', approvedBy: 'admin-1' });
    expect(result.autoRefund).toBe(true);
  });
});
