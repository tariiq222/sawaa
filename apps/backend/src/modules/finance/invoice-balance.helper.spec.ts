import { calculateInvoiceBalance, InvoiceBalanceMismatchError } from './invoice-balance.helper';

const base = {
  invoiceTotal: 50_000,
  grossSettled: 50_000,
  refundedSettled: 20_000,
  reservedPending: 0,
  newCollectionBlocked: true,
};

describe('calculateInvoiceBalance', () => {
  it('preserves a refunded 500 SAR invoice balance while honoring a blocked collection policy', () => {
    expect(calculateInvoiceBalance(base)).toEqual({
      netSettled: 30_000, outstanding: 20_000, availableToCollect: 0, overCollected: 0,
    });
  });

  it('limits an explicitly allowed recollection to 200 SAR, not the whole invoice', () => {
    expect(calculateInvoiceBalance({ ...base, newCollectionBlocked: false })).toEqual({
      netSettled: 30_000, outstanding: 20_000, availableToCollect: 20_000, overCollected: 0,
    });
  });

  it('subtracts active reservations only from collection capacity', () => {
    expect(calculateInvoiceBalance({
      ...base, grossSettled: 10_000, refundedSettled: 0,
      reservedPending: 15_000, newCollectionBlocked: false,
    })).toEqual({
      netSettled: 10_000, outstanding: 40_000, availableToCollect: 25_000, overCollected: 0,
    });
  });

  it('reports existing overcollection rather than hiding it in a zero balance', () => {
    expect(calculateInvoiceBalance({ ...base, grossSettled: 80_000 })).toEqual({
      netSettled: 60_000, outstanding: 0, availableToCollect: 0, overCollected: 10_000,
    });
  });

  it.each([
    { total: 0, settled: 0, reserved: 0, outstanding: 0, available: 0 },
    { total: 1, settled: 0, reserved: 0, outstanding: 1, available: 1 },
    { total: 1, settled: 0, reserved: 2, outstanding: 1, available: 0 },
    { total: Number.MAX_SAFE_INTEGER, settled: 0, reserved: 0,
      outstanding: Number.MAX_SAFE_INTEGER, available: Number.MAX_SAFE_INTEGER },
  ])('handles an unpaid total of $total with reservation $reserved exactly', (row) => {
    expect(calculateInvoiceBalance({
      invoiceTotal: row.total, grossSettled: row.settled, refundedSettled: 0,
      reservedPending: row.reserved, newCollectionBlocked: false,
    })).toEqual({
      netSettled: 0, outstanding: row.outstanding,
      availableToCollect: row.available, overCollected: 0,
    });
  });

  it('raises an explicit mismatch when completed refunds exceed settled money', () => {
    expect(() => calculateInvoiceBalance({ ...base, refundedSettled: 50_001 }))
      .toThrow(InvoiceBalanceMismatchError);
  });

  it.each(['invoiceTotal', 'grossSettled', 'refundedSettled', 'reservedPending'] as const)(
    'rejects invalid %s values without rounding fractional halalas', (field) => {
      for (const value of [-1, 0.1, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '100']) {
        expect(() => calculateInvoiceBalance({ ...base, [field]: value } as never)).toThrow(RangeError);
      }
    },
  );

  it('requires an explicit policy decision instead of defaulting a missing boolean', () => {
    expect(() => calculateInvoiceBalance({ ...base, newCollectionBlocked: undefined } as never))
      .toThrow(TypeError);
  });
});
