import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { CompleteBookingHandler } from './complete-booking.handler';
import { buildPrisma, buildRlsTransaction, mockBooking } from '../testing/booking-test-helpers';

const buildLedger = () => ({
  ensureBookingInvoiceInTx: jest.fn().mockResolvedValue(null),
});

describe('CompleteBookingHandler', () => {
  it('accepts DEPOSIT_PAID without settling its outstanding balance', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique.mockResolvedValue({ ...mockBooking, status: BookingStatus.DEPOSIT_PAID, checkedInAt: null });
    await new CompleteBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildLedger() as never).execute({ bookingId: 'book-1', changedBy: 'user-42' });
    const { where, data } = prisma.booking.updateMany.mock.calls[0][0];
    expect(where.status).toBe(BookingStatus.DEPOSIT_PAID);
    expect(data.status).toBe(BookingStatus.COMPLETED);
    expect(data).not.toHaveProperty('paidAmount');
    expect(data).not.toHaveProperty('remainingAmount');
    expect(prisma.bookingStatusLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ fromStatus: BookingStatus.DEPOSIT_PAID, toStatus: BookingStatus.COMPLETED }),
    });
  });

  it('completes CONFIRMED booking', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CONFIRMED });
    await new CompleteBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildLedger() as never).execute({ bookingId: 'book-1', changedBy: 'user-42' });
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: BookingStatus.COMPLETED }) }),
    );
  });

  it('throws BadRequestException when booking is not CONFIRMED', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue({ ...mockBooking, status: BookingStatus.CANCELLED });
    await expect(
      new CompleteBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildLedger() as never).execute({ bookingId: 'book-1', changedBy: 'user-42' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when not found', async () => {
    const prisma = buildPrisma();
    prisma.booking.findUnique = jest.fn().mockResolvedValue(null);
    await expect(
      new CompleteBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildLedger() as never).execute({ bookingId: 'bad', changedBy: 'user-42' }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('CompleteBookingHandler — package credit consumption', () => {
  it('consumes the session when a booking is completed without a check-in', async () => {
    const prisma = buildPrisma();
    const packageBooking = { ...mockBooking, status: BookingStatus.CONFIRMED, packageCreditId: 'credit-1' };
    prisma.booking.findUnique.mockResolvedValue(packageBooking);

    await new CompleteBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildLedger() as never).execute({ bookingId: 'book-1', changedBy: 'user-42' });

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
    const paidBooking = { ...mockBooking, status: BookingStatus.CONFIRMED, packageCreditId: null };
    prisma.booking.findUnique.mockResolvedValue(paidBooking);

    await new CompleteBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildLedger() as never).execute({ bookingId: 'book-1', changedBy: 'user-42' });

    expect(prisma.packageCreditUsage.findFirst).not.toHaveBeenCalled();
    expect(prisma.packageCredit.update).not.toHaveBeenCalled();
  });
});

describe('CompleteBookingHandler — status log', () => {
  it('writes a BookingStatusLog entry on complete', async () => {
    const prisma = buildPrisma();
    const confirmedBooking = { ...mockBooking, status: BookingStatus.CONFIRMED };
    prisma.booking.findUnique.mockResolvedValue(confirmedBooking);
    const handler = new CompleteBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildLedger() as never);

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

  it('asks the ledger to create a payAtClinic invoice on completion', async () => {
    const prisma = buildPrismaWithInvoice();
    const ledger = buildLedger();
    const confirmedBooking = {
      ...mockBooking,
      status: BookingStatus.CONFIRMED,
      payAtClinic: true,
      price: new Prisma.Decimal(100),
      discountedPrice: null,
      currency: 'SAR',
    };
    prisma.booking.findUnique = jest.fn().mockResolvedValue(confirmedBooking);

    await new CompleteBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, ledger as never).execute({ bookingId: 'book-1', changedBy: 'user-42' });

    expect(ledger.ensureBookingInvoiceInTx).toHaveBeenCalledTimes(1);
    const cmd = ledger.ensureBookingInvoiceInTx.mock.calls[0][1];
    expect(cmd.subtotal.toString()).toBe('100');
    expect(cmd.issueMode).toBe('ISSUED');
  });

  it('does NOT create an invoice when payAtClinic is false', async () => {
    const prisma = buildPrismaWithInvoice();
    const confirmedBooking = {
      ...mockBooking,
      status: BookingStatus.CONFIRMED,
      payAtClinic: false,
    };
    prisma.booking.findUnique = jest.fn().mockResolvedValue(confirmedBooking);

    await new CompleteBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, buildLedger() as never).execute({ bookingId: 'book-1', changedBy: 'user-42' });

    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it('delegates the duplicate-invoice no-op to the ledger', async () => {
    const prisma = buildPrismaWithInvoice();
    const ledger = buildLedger();
    const confirmedBooking = {
      ...mockBooking,
      status: BookingStatus.CONFIRMED,
      payAtClinic: true,
    };
    prisma.booking.findUnique = jest.fn().mockResolvedValue(confirmedBooking);

    await new CompleteBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, ledger as never).execute({ bookingId: 'book-1', changedBy: 'user-42' });

    // The ledger owns the existing-invoice check; the handler still writes nothing.
    expect(ledger.ensureBookingInvoiceInTx).toHaveBeenCalledTimes(1);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it('passes discountedPrice as the ledger subtotal when present', async () => {
    const prisma = buildPrisma();
    const ledger = buildLedger();
    const confirmedBooking = {
      ...mockBooking,
      status: BookingStatus.CONFIRMED,
      payAtClinic: true,
      price: new Prisma.Decimal(100),
      discountedPrice: new Prisma.Decimal(80),
      currency: 'SAR',
    };
    prisma.booking.findUnique = jest.fn().mockResolvedValue(confirmedBooking);

    await new CompleteBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, ledger as never).execute({ bookingId: 'book-1', changedBy: 'user-42' });

    const cmd = ledger.ensureBookingInvoiceInTx.mock.calls[0][1];
    expect(cmd.subtotal.toString()).toBe('80');
  });

  it('leaves the VAT rate to the ledger so OrganizationSettings stays the single source', async () => {
    const prisma = buildPrisma();
    const ledger = buildLedger();
    const confirmedBooking = {
      ...mockBooking,
      status: BookingStatus.CONFIRMED,
      payAtClinic: true,
      price: new Prisma.Decimal(200),
      discountedPrice: null,
      currency: 'SAR',
    };
    prisma.booking.findUnique = jest.fn().mockResolvedValue(confirmedBooking);

    await new CompleteBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, ledger as never).execute({ bookingId: 'book-1', changedBy: 'user-42' });

    const cmd = ledger.ensureBookingInvoiceInTx.mock.calls[0][1];
    // The handler must not resolve or compute VAT itself any more.
    expect(cmd).not.toHaveProperty('vatRate');
    expect((prisma as { organizationSettings?: { findFirst?: jest.Mock } }).organizationSettings?.findFirst).toBeUndefined();
    expect(cmd.subtotal.toString()).toBe('200');
  });

  it('keeps the discounted net amount as the ledger subtotal, leaving VAT to the ledger', async () => {
    const prisma = buildPrisma();
    const ledger = buildLedger();
    const confirmedBooking = {
      ...mockBooking,
      status: BookingStatus.CONFIRMED,
      payAtClinic: true,
      price: new Prisma.Decimal(10000),
      discountedPrice: new Prisma.Decimal(8000),
      currency: 'SAR',
    };
    prisma.booking.findUnique = jest.fn().mockResolvedValue(confirmedBooking);

    await new CompleteBookingHandler(prisma as never, buildRlsTransaction(prisma) as never, ledger as never).execute({ bookingId: 'book-1', changedBy: 'user-42' });

    const cmd = ledger.ensureBookingInvoiceInTx.mock.calls[0][1];
    expect(cmd.subtotal.toString()).toBe('8000');
    expect(cmd.issueMode).toBe('ISSUED');
    expect(cmd.issuedAt).toBeInstanceOf(Date);
  });
});

describe('CompleteBookingHandler — payAtClinic invoice', () => {
  it('delegates invoice creation to the finance ledger, not to Prisma directly', async () => {
    const prisma = buildPrisma();
    const ledger = buildLedger();
    prisma.booking.findUnique.mockResolvedValue({
      ...mockBooking,
      status: BookingStatus.CONFIRMED,
      payAtClinic: true,
      discountedPrice: null,
    });

    await new CompleteBookingHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      ledger as never,
    ).execute({ bookingId: 'book-1', changedBy: 'user-42' });

    expect(ledger.ensureBookingInvoiceInTx).toHaveBeenCalledTimes(1);
    const [txArg, cmd] = ledger.ensureBookingInvoiceInTx.mock.calls[0];
    expect(txArg).toBeDefined();
    expect(cmd).toMatchObject({
      bookingId: 'book-1',
      issueMode: 'ISSUED',
    });
    // The handler must no longer write the invoice itself.
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it('does not call the ledger for a prepaid booking', async () => {
    const prisma = buildPrisma();
    const ledger = buildLedger();
    prisma.booking.findUnique.mockResolvedValue({
      ...mockBooking,
      status: BookingStatus.CONFIRMED,
      payAtClinic: false,
    });

    await new CompleteBookingHandler(
      prisma as never,
      buildRlsTransaction(prisma) as never,
      ledger as never,
    ).execute({ bookingId: 'book-1', changedBy: 'user-42' });

    expect(ledger.ensureBookingInvoiceInTx).not.toHaveBeenCalled();
  });
});
