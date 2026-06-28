import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EnsureBookingInvoiceHandler } from './ensure-booking-invoice.handler';

const dec = (n: number) => new Prisma.Decimal(n);

const buildBooking = (overrides: Record<string, unknown> = {}) => ({
  id: 'booking-1',
  branchId: 'branch-1',
  clientId: 'client-1',
  employeeId: 'emp-1',
  price: dec(40000),
  discountedPrice: null,
  ...overrides,
});

const invoiceRow = {
  id: 'inv-1',
  subtotal: dec(40000),
  vatRate: dec(0),
  total: dec(40000),
  status: 'DRAFT',
};

function build(bookingOverrides: Record<string, unknown> = {}) {
  const prisma = {
    booking: { findUnique: jest.fn().mockResolvedValue(buildBooking(bookingOverrides)) },
    invoice: {
      // Existence check: no invoice yet by default. shape() uses findUniqueOrThrow.
      findUnique: jest.fn().mockResolvedValue(null),
      findUniqueOrThrow: jest.fn().mockResolvedValue(invoiceRow),
    },
    payment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
  };
  const createInvoice = { execute: jest.fn().mockResolvedValue({ id: 'inv-1' }) };
  const handler = new EnsureBookingInvoiceHandler(prisma as never, createInvoice as never);
  return { handler, prisma, createInvoice };
}

describe('EnsureBookingInvoiceHandler', () => {
  it('throws when the booking does not exist', async () => {
    const { handler, prisma } = build();
    prisma.booking.findUnique.mockResolvedValueOnce(null);
    await expect(handler.execute({ bookingId: 'missing' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a DRAFT invoice when the booking has none', async () => {
    const { handler, createInvoice } = build();
    const result = await handler.execute({ bookingId: 'booking-1' });
    expect(createInvoice.execute).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'booking-1', subtotal: 40000, discountAmt: undefined }),
    );
    expect(result).toEqual({
      id: 'inv-1',
      subtotal: 40000,
      vatRate: 0,
      total: 40000,
      outstanding: 40000,
      status: 'DRAFT',
    });
  });

  it('passes the stored discount as discountAmt', async () => {
    const { handler, createInvoice } = build({ discountedPrice: dec(35000) });
    await handler.execute({ bookingId: 'booking-1' });
    expect(createInvoice.execute).toHaveBeenCalledWith(
      expect.objectContaining({ subtotal: 40000, discountAmt: 5000 }),
    );
  });

  it('returns the existing invoice without creating a new one', async () => {
    const { handler, prisma, createInvoice } = build();
    prisma.invoice.findUnique.mockResolvedValueOnce({ id: 'inv-1' });
    await handler.execute({ bookingId: 'booking-1' });
    expect(createInvoice.execute).not.toHaveBeenCalled();
  });

  it('rejects a guest booking with no client', async () => {
    const { handler } = build({ clientId: null });
    await expect(handler.execute({ bookingId: 'booking-1' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a zero-price booking', async () => {
    const { handler } = build({ price: dec(0) });
    await expect(handler.execute({ bookingId: 'booking-1' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recovers the invoice when a concurrent create races (409)', async () => {
    const { handler, prisma, createInvoice } = build();
    prisma.invoice.findUnique
      .mockResolvedValueOnce(null) // existence check — none yet
      .mockResolvedValueOnce({ id: 'inv-1' }); // race recovery — created by the other tx
    createInvoice.execute.mockRejectedValueOnce(new ConflictException({ code: 'INVOICE_ALREADY_EXISTS' }));
    const result = await handler.execute({ bookingId: 'booking-1' });
    expect(result.id).toBe('inv-1');
  });
});
