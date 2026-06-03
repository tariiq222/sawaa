import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import { DeleteBookingHandler } from './delete-booking.handler';

const buildPrisma = (overrides: Record<string, unknown> = {}) => {
  const tx = {
    invoice: {
      findUnique: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({ id: 'inv-1' }),
    },
    refundRequest: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    payment: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    bookingStatusLog: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    rating: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    intakeResponse: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    bundleUsage: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    booking: { delete: jest.fn().mockResolvedValue({ id: 'book-1' }) },
  };
  const prisma = {
    booking: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'book-1',
        status: BookingStatus.EXPIRED,
      }),
    },
    payment: { findFirst: jest.fn().mockResolvedValue(null) },
    ...overrides,
  };
  return { prisma, tx };
};

const buildRls = (tx: unknown) => ({
  withTransaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
});

describe('DeleteBookingHandler', () => {
  it('hard-deletes a clean terminal booking with no invoice', async () => {
    const { prisma, tx } = buildPrisma();
    await new DeleteBookingHandler(prisma as never, buildRls(tx) as never).execute({
      bookingId: 'book-1',
      changedBy: 'admin-1',
    });

    expect(tx.invoice.delete).not.toHaveBeenCalled();
    expect(tx.bookingStatusLog.deleteMany).toHaveBeenCalledWith({ where: { bookingId: 'book-1' } });
    expect(tx.rating.deleteMany).toHaveBeenCalledWith({ where: { bookingId: 'book-1' } });
    expect(tx.intakeResponse.deleteMany).toHaveBeenCalledWith({ where: { bookingId: 'book-1' } });
    expect(tx.bundleUsage.updateMany).toHaveBeenCalledWith({
      where: { bookingId: 'book-1' },
      data: { bookingId: null },
    });
    expect(tx.booking.delete).toHaveBeenCalledWith({ where: { id: 'book-1' } });
  });

  it('deletes invoice, payments and refund requests when an invoice exists', async () => {
    const { prisma, tx } = buildPrisma();
    tx.invoice.findUnique = jest.fn().mockResolvedValue({ id: 'inv-1' });

    await new DeleteBookingHandler(prisma as never, buildRls(tx) as never).execute({
      bookingId: 'book-1',
      changedBy: 'admin-1',
    });

    expect(tx.refundRequest.deleteMany).toHaveBeenCalledWith({ where: { invoiceId: 'inv-1' } });
    expect(tx.payment.deleteMany).toHaveBeenCalledWith({ where: { invoiceId: 'inv-1' } });
    expect(tx.invoice.delete).toHaveBeenCalledWith({ where: { id: 'inv-1' } });
    expect(tx.booking.delete).toHaveBeenCalled();
  });

  it.each([
    PaymentStatus.COMPLETED,
    PaymentStatus.REFUNDED,
    PaymentStatus.PENDING_VERIFICATION,
  ])('rejects deletion when a %s payment exists', async (status) => {
    const { prisma, tx } = buildPrisma({
      payment: { findFirst: jest.fn().mockResolvedValue({ id: 'pay-1', status }) },
    });

    await expect(
      new DeleteBookingHandler(prisma as never, buildRls(tx) as never).execute({
        bookingId: 'book-1',
        changedBy: 'admin-1',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(tx.booking.delete).not.toHaveBeenCalled();
  });

  it('rejects deletion of a non-terminal (active) booking', async () => {
    const { prisma, tx } = buildPrisma({
      booking: {
        findFirst: jest.fn().mockResolvedValue({ id: 'book-1', status: BookingStatus.CONFIRMED }),
      },
    });

    await expect(
      new DeleteBookingHandler(prisma as never, buildRls(tx) as never).execute({
        bookingId: 'book-1',
        changedBy: 'admin-1',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.payment.findFirst).not.toHaveBeenCalled();
    expect(tx.booking.delete).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the booking does not exist', async () => {
    const { prisma, tx } = buildPrisma({
      booking: { findFirst: jest.fn().mockResolvedValue(null) },
    });

    await expect(
      new DeleteBookingHandler(prisma as never, buildRls(tx) as never).execute({
        bookingId: 'missing',
        changedBy: 'admin-1',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
