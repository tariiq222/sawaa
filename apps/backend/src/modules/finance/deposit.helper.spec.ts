import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  resolveInvoiceDeposit,
  assertDepositPaymentAmount,
  isDepositPayment,
  type DepositPrismaClient,
} from './deposit.helper';

const buildClient = (
  booking: { serviceId: string } | null,
  service: { depositEnabled: boolean; depositAmount: unknown } | null,
): DepositPrismaClient => ({
  booking: { findFirst: jest.fn().mockResolvedValue(booking) },
  service: { findFirst: jest.fn().mockResolvedValue(service) },
});

describe('resolveInvoiceDeposit', () => {
  it('returns disabled for a null bookingId (bundle purchase)', async () => {
    const client = buildClient(null, null);
    const result = await resolveInvoiceDeposit(client, null);
    expect(result).toEqual({ enabled: false, depositAmount: null });
    expect(client.booking.findFirst).not.toHaveBeenCalled();
  });

  it('returns disabled when the service has no deposit', async () => {
    const client = buildClient({ serviceId: 'svc-1' }, { depositEnabled: false, depositAmount: null });
    const result = await resolveInvoiceDeposit(client, 'book-1');
    expect(result).toEqual({ enabled: false, depositAmount: null });
  });

  it('loads the booking then the service via scalar bookingId (no relation)', async () => {
    const client = buildClient(
      { serviceId: 'svc-1' },
      { depositEnabled: true, depositAmount: new Prisma.Decimal(5000) },
    );
    const result = await resolveInvoiceDeposit(client, 'book-1');
    expect(client.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'book-1' } }),
    );
    expect(client.service.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'svc-1' } }),
    );
    expect(result).toEqual({ enabled: true, depositAmount: 5000 });
  });

  it('coerces a Decimal halalas value to an integer', async () => {
    const client = buildClient(
      { serviceId: 'svc-1' },
      { depositEnabled: true, depositAmount: new Prisma.Decimal('5000.00') },
    );
    const result = await resolveInvoiceDeposit(client, 'book-1');
    expect(result.depositAmount).toBe(5000);
  });

  it('treats a depositEnabled service with a non-positive amount as no deposit', async () => {
    const client = buildClient(
      { serviceId: 'svc-1' },
      { depositEnabled: true, depositAmount: new Prisma.Decimal(0) },
    );
    const result = await resolveInvoiceDeposit(client, 'book-1');
    expect(result).toEqual({ enabled: false, depositAmount: null });
  });

  it('treats a missing service row as no deposit', async () => {
    const client = buildClient({ serviceId: 'svc-1' }, null);
    const result = await resolveInvoiceDeposit(client, 'book-1');
    expect(result).toEqual({ enabled: false, depositAmount: null });
  });
});

describe('assertDepositPaymentAmount', () => {
  const base = { depositAmount: 5000, outstanding: 23000, alreadyPaid: 0 };

  it('accepts the exact deposit amount', () => {
    expect(() => assertDepositPaymentAmount({ ...base, amount: 5000 })).not.toThrow();
  });

  it('accepts the full outstanding total', () => {
    expect(() => assertDepositPaymentAmount({ ...base, amount: 23000 })).not.toThrow();
  });

  it('rejects an amount below the deposit', () => {
    expect(() => assertDepositPaymentAmount({ ...base, amount: 3000 })).toThrow(BadRequestException);
  });

  it('rejects an amount between the deposit and the full total', () => {
    expect(() => assertDepositPaymentAmount({ ...base, amount: 10000 })).toThrow(BadRequestException);
  });

  it('includes both the deposit and the total in the error message', () => {
    expect(() => assertDepositPaymentAmount({ ...base, amount: 3000 })).toThrow(
      'Payment must equal the deposit amount (5000) or the full total (23000)',
    );
  });

  it('does not govern follow-up payments once money has been collected', () => {
    expect(() =>
      assertDepositPaymentAmount({ ...base, amount: 18000, outstanding: 18000, alreadyPaid: 5000 }),
    ).not.toThrow();
  });
});

describe('isDepositPayment', () => {
  it('is true when the deposit was collected and a balance remains', () => {
    expect(isDepositPayment({ paidAfter: 5000, total: 23000, depositAmount: 5000 })).toBe(true);
  });

  it('is false when the full total was paid', () => {
    expect(isDepositPayment({ paidAfter: 23000, total: 23000, depositAmount: 5000 })).toBe(false);
  });

  it('is false when there is no configured deposit', () => {
    expect(isDepositPayment({ paidAfter: 5000, total: 23000, depositAmount: null })).toBe(false);
  });

  it('is false when the partial amount is not the deposit', () => {
    expect(isDepositPayment({ paidAfter: 4000, total: 23000, depositAmount: 5000 })).toBe(false);
  });
});
