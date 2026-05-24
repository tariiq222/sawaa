import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { CompleteBookingHandler } from './complete-booking.handler';
import { buildPrisma, buildRlsTransaction, mockBooking } from '../testing/booking-test-helpers';

describe('CompleteBookingHandler', () => {
  it('completes CONFIRMED booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });
    await new CompleteBookingHandler(prisma as never, buildRlsTransaction(prisma) as never).execute({ bookingId: 'book-1', changedBy: 'user-42' });
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.COMPLETED }) }),
    );
  });

  it('throws BadRequestException when booking is not CONFIRMED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CANCELLED });
    await expect(
      new CompleteBookingHandler(prisma as never, buildRlsTransaction(prisma) as never).execute({ bookingId: 'book-1', changedBy: 'user-42' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue(null);
    await expect(
      new CompleteBookingHandler(prisma as never, buildRlsTransaction(prisma) as never).execute({ bookingId: 'bad', changedBy: 'user-42' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('CompleteBookingHandler — status log', () => {
  it('writes a BookingStatusLog entry on complete', async () => {
    const prisma = buildPrisma();
    const confirmedBooking = { ...mockBooking, status: BookingStatus.CONFIRMED };
    prisma.booking.findUnique.mockResolvedValue(confirmedBooking);
    const handler = new CompleteBookingHandler(prisma as never, buildRlsTransaction(prisma) as never);

    await handler.execute({ bookingId: 'book-1', changedBy: 'user-42' });

    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromStatus: BookingStatus.CONFIRMED,
        toStatus: BookingStatus.COMPLETED,
        changedBy: 'user-42',
      }),
    });
  });
});

describe('payAtClinic invoice creation', () => {
  function buildPrismaWithInvoice() {
    const prisma = buildPrisma() as ReturnType<typeof buildPrisma> & {
      invoice: { findMany: jest.Mock; findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock };
      organizationSettings: { findFirst: jest.Mock };
    };
    prisma.invoice = {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'inv-1' }),
    };
    prisma.organizationSettings = {
      findFirst: jest.fn().mockResolvedValue({ vatRate: '0.15' }),
    };
    return prisma;
  }

  it('creates an Invoice on completion when payAtClinic is true and none exists', async () => {
    const prisma = buildPrismaWithInvoice();
    const confirmedBooking = {
      ...mockBooking,
      status: BookingStatus.CONFIRMED,
      payAtClinic: true,
      price: 100,
      discountedPrice: null,
      currency: 'SAR',
    };
    prisma.booking.findUnique = jest.fn().mockResolvedValue(confirmedBooking);

    await new CompleteBookingHandler(prisma as never, buildRlsTransaction(prisma) as never).execute({ bookingId: 'book-1', changedBy: 'user-42' });

    const invoiceData = prisma.invoice.create.mock.calls[0][0].data;
    expect(invoiceData.subtotal.toString()).toBe('100');
    expect(invoiceData.vatRate.toString()).toBe('0.15');
    expect(invoiceData.vatAmt.toString()).toBe('15');
    expect(invoiceData.total.toString()).toBe('115');
    expect(invoiceData.status).toBe('ISSUED');
  });

  it('does NOT create an invoice when payAtClinic is false', async () => {
    const prisma = buildPrismaWithInvoice();
    const confirmedBooking = {
      ...mockBooking,
      status: BookingStatus.CONFIRMED,
      payAtClinic: false,
    };
    prisma.booking.findUnique = jest.fn().mockResolvedValue(confirmedBooking);

    await new CompleteBookingHandler(prisma as never, buildRlsTransaction(prisma) as never).execute({ bookingId: 'book-1', changedBy: 'user-42' });

    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it('does NOT create a duplicate invoice when one already exists', async () => {
    const prisma = buildPrismaWithInvoice();
    prisma.invoice.findUnique = jest.fn().mockResolvedValue({ id: 'inv-1' });
    const confirmedBooking = {
      ...mockBooking,
      status: BookingStatus.CONFIRMED,
      payAtClinic: true,
    };
    prisma.booking.findUnique = jest.fn().mockResolvedValue(confirmedBooking);

    await new CompleteBookingHandler(prisma as never, buildRlsTransaction(prisma) as never).execute({ bookingId: 'book-1', changedBy: 'user-42' });

    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it('uses discountedPrice when present', async () => {
    const prisma = buildPrismaWithInvoice();
    const confirmedBooking = {
      ...mockBooking,
      status: BookingStatus.CONFIRMED,
      payAtClinic: true,
      price: 100,
      discountedPrice: 80,
      currency: 'SAR',
    };
    prisma.booking.findUnique = jest.fn().mockResolvedValue(confirmedBooking);

    await new CompleteBookingHandler(prisma as never, buildRlsTransaction(prisma) as never).execute({ bookingId: 'book-1', changedBy: 'user-42' });

    const invoiceData = prisma.invoice.create.mock.calls[0][0].data;
    expect(invoiceData.subtotal.toString()).toBe('80');
  });

  it('uses per-org vatRate from OrganizationSettings', async () => {
    const prisma = buildPrismaWithInvoice();
    prisma.organizationSettings.findFirst = jest.fn().mockResolvedValue({ vatRate: '0.05' });
    const confirmedBooking = {
      ...mockBooking,
      status: BookingStatus.CONFIRMED,
      payAtClinic: true,
      price: 200,
      discountedPrice: null,
      currency: 'SAR',
    };
    prisma.booking.findUnique = jest.fn().mockResolvedValue(confirmedBooking);

    await new CompleteBookingHandler(prisma as never, buildRlsTransaction(prisma) as never).execute({ bookingId: 'book-1', changedBy: 'user-42' });

    const invoiceData = prisma.invoice.create.mock.calls[0][0].data;
    expect(invoiceData.vatAmt.toString()).toBe('10');
    expect(invoiceData.total.toString()).toBe('210');
  });

  it('creates payAtClinic invoice using computeVat with discount applied', async () => {
    // subtotal=8000 (discountedPrice), vatRate=0.15
    // vatAmt = round_half_up(8000 * 0.15) = 1200
    // total  = 8000 + 1200 = 9200
    const prisma = buildPrismaWithInvoice();
    const confirmedBooking = {
      ...mockBooking,
      status: BookingStatus.CONFIRMED,
      payAtClinic: true,
      price: 10000,
      discountedPrice: 8000,
      currency: 'SAR',
    };
    prisma.booking.findUnique = jest.fn().mockResolvedValue(confirmedBooking);

    await new CompleteBookingHandler(prisma as never, buildRlsTransaction(prisma) as never).execute({ bookingId: 'book-1', changedBy: 'user-42' });

    const invoiceData = prisma.invoice.create.mock.calls[0][0].data;
    expect(invoiceData.subtotal.toString()).toBe('8000');
    expect(invoiceData.vatAmt.toString()).toBe('1200');
    expect(invoiceData.total.toString()).toBe('9200');
  });
});
