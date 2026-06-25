import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  resolveInvoiceDeposit,
  assertDepositPaymentAmount,
  isDepositPayment,
  type DepositPrismaClient,
} from './deposit.helper';

const buildClient = (
  booking: { serviceId: string | null; programId?: string | null } | null,
  service: { depositEnabled: boolean; depositAmount: unknown } | null = null,
  program: { depositEnabled: boolean; depositAmount: unknown } | null = null,
): DepositPrismaClient => ({
  booking: { findFirst: jest.fn().mockResolvedValue(booking) },
  service: { findFirst: jest.fn().mockResolvedValue(service) },
  ...(program !== null
    ? {
        program: { findFirst: jest.fn().mockResolvedValue(program) },
      }
    : {}),
});

describe('resolveInvoiceDeposit', () => {
  it('returns disabled for a null bookingId (package purchase)', async () => {
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

  describe('program (GROUP booking) branch', () => {
    it('resolves deposit from the program when booking has no serviceId', async () => {
      const client = buildClient(
        { serviceId: null, programId: 'prog-1' },
        null,
        { depositEnabled: true, depositAmount: new Prisma.Decimal(7500) },
      );
      const result = await resolveInvoiceDeposit(client, 'book-1');
      expect(client.program!.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'prog-1' } }),
      );
      expect(result).toEqual({ enabled: true, depositAmount: 7500 });
    });

    it('returns disabled when the program has no deposit configured', async () => {
      const client = buildClient(
        { serviceId: null, programId: 'prog-1' },
        null,
        { depositEnabled: false, depositAmount: null },
      );
      const result = await resolveInvoiceDeposit(client, 'book-1');
      expect(result).toEqual({ enabled: false, depositAmount: null });
    });

    it('returns disabled when the program delegate is absent (legacy callers)', async () => {
      // No `program` accessor on the client — the program branch must
      // gracefully degrade to "no deposit" rather than throwing.
      const client: DepositPrismaClient = {
        booking: {
          findFirst: jest.fn().mockResolvedValue({ serviceId: null, programId: 'prog-1' }),
        },
        service: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      const result = await resolveInvoiceDeposit(client, 'book-1');
      expect(result).toEqual({ enabled: false, depositAmount: null });
    });

    it('prefers the service when both serviceId and programId are set', async () => {
      const client = buildClient(
        { serviceId: 'svc-1', programId: 'prog-1' },
        { depositEnabled: true, depositAmount: new Prisma.Decimal(2000) },
        { depositEnabled: true, depositAmount: new Prisma.Decimal(7500) },
      );
      const result = await resolveInvoiceDeposit(client, 'book-1');
      expect(client.service.findFirst).toHaveBeenCalled();
      expect(client.program!.findFirst).not.toHaveBeenCalled();
      expect(result).toEqual({ enabled: true, depositAmount: 2000 });
    });

    it('returns disabled when booking has neither serviceId nor programId', async () => {
      const client = buildClient({ serviceId: null, programId: null }, null, null);
      const result = await resolveInvoiceDeposit(client, 'book-1');
      expect(result).toEqual({ enabled: false, depositAmount: null });
    });

    it('treats a missing program row as no deposit', async () => {
      const client = buildClient(
        { serviceId: null, programId: 'prog-missing' },
        null,
        null,
      );
      const result = await resolveInvoiceDeposit(client, 'book-1');
      expect(result).toEqual({ enabled: false, depositAmount: null });
    });
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
