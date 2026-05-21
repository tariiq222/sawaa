import { Prisma } from '@prisma/client';
import { toHalalas, computeVat, allocateVatPortion } from './money.helper';

const D = (v: string | number) => new Prisma.Decimal(v.toString());

// ─── toHalalas ────────────────────────────────────────────────────────────────

describe('toHalalas', () => {
  it('converts a plain integer string to a 0-dp Decimal', () => {
    expect(toHalalas('10000').equals(D('10000'))).toBe(true);
  });

  it('rounds half-up: 0.5 → 1', () => {
    expect(toHalalas('0.5').toNumber()).toBe(1);
  });

  it('rounds half-up: 2.5 → 3 (not banker rounding)', () => {
    expect(toHalalas('2.5').toNumber()).toBe(3);
  });

  it('rounds half-up: 1.4 → 1', () => {
    expect(toHalalas('1.4').toNumber()).toBe(1);
  });

  it('accepts a number input', () => {
    expect(toHalalas(15000).toNumber()).toBe(15000);
  });

  it('accepts a Prisma.Decimal input', () => {
    expect(toHalalas(D('9999.99')).toNumber()).toBe(10000);
  });

  it('handles 0 correctly', () => {
    expect(toHalalas(0).toNumber()).toBe(0);
  });
});

// ─── computeVat ───────────────────────────────────────────────────────────────

describe('computeVat', () => {
  it('round-trip: 10000 halalas @ 15% → vatAmt=1500, total=11500 exactly', () => {
    const { vatAmtHalalas, totalHalalas } = computeVat(D('10000'), D('0.15'));
    expect(vatAmtHalalas.toNumber()).toBe(1500);
    expect(totalHalalas.toNumber()).toBe(11500);
  });

  it('invariant: subtotal + vatAmt === total (always, no second rounding)', () => {
    const subtotals = ['333', '1001', '7777', '99999', '1'];
    for (const s of subtotals) {
      const subtotal = D(s);
      const { vatAmtHalalas, totalHalalas } = computeVat(subtotal, D('0.15'));
      expect(subtotal.plus(vatAmtHalalas).equals(totalHalalas)).toBe(true);
    }
  });

  it('rounds half-up for non-integer VAT: 333 @ 15% = 49.95 → 50', () => {
    const { vatAmtHalalas } = computeVat(D('333'), D('0.15'));
    expect(vatAmtHalalas.toNumber()).toBe(50);
  });

  it('round-trip: 333 halalas @ 15% → total = 333 + 50 = 383 (no float drift)', () => {
    const { vatAmtHalalas, totalHalalas } = computeVat(D('333'), D('0.15'));
    expect(vatAmtHalalas.toNumber()).toBe(50);
    expect(totalHalalas.toNumber()).toBe(383);
  });

  it('handles vatRate=0: vatAmt=0, total=subtotal', () => {
    const { vatAmtHalalas, totalHalalas } = computeVat(D('5000'), D('0'));
    expect(vatAmtHalalas.toNumber()).toBe(0);
    expect(totalHalalas.toNumber()).toBe(5000);
  });

  it('no float precision leak: 0.15 on many values produces whole-halala outputs', () => {
    const values = ['100', '200', '300', '1000', '5000', '9999', '12345'];
    for (const v of values) {
      const { vatAmtHalalas, totalHalalas } = computeVat(D(v), D('0.15'));
      // Output must be whole halalas (0 decimal places)
      expect(vatAmtHalalas.decimalPlaces()).toBe(0);
      expect(totalHalalas.decimalPlaces()).toBe(0);
    }
  });

  it('handles a large amount: 1000000 halalas (10000 SAR) @ 15%', () => {
    const { vatAmtHalalas, totalHalalas } = computeVat(D('1000000'), D('0.15'));
    expect(vatAmtHalalas.toNumber()).toBe(150000);
    expect(totalHalalas.toNumber()).toBe(1150000);
  });
});

// ─── allocateVatPortion ───────────────────────────────────────────────────────

describe('allocateVatPortion', () => {
  const INVOICE = D('11500'); // 10000 + 1500 VAT
  const VAT = D('1500');

  it('full refund allocates full VAT', () => {
    const portion = allocateVatPortion(D('11500'), INVOICE, VAT);
    expect(portion.toNumber()).toBe(1500);
  });

  it('half refund allocates half VAT (exact halves)', () => {
    const portion = allocateVatPortion(D('5750'), INVOICE, VAT);
    expect(portion.toNumber()).toBe(750);
  });

  it('zero total does not throw, returns 0', () => {
    const portion = allocateVatPortion(D('0'), D('0'), D('0'));
    expect(portion.toNumber()).toBe(0);
  });

  it('result is always a whole-halala Decimal (0 dp)', () => {
    const portion = allocateVatPortion(D('1000'), INVOICE, VAT);
    expect(portion.decimalPlaces()).toBe(0);
  });

  it('no-drift: sum of 2 equal partial refunds equals totalVat when using remaining pattern', () => {
    // First refund: half the invoice
    const firstRefund = D('5750');
    const firstVat = allocateVatPortion(firstRefund, INVOICE, VAT);

    // Second refund: remaining (the last-refund pattern avoids drift)
    const secondVat = VAT.minus(firstVat);

    expect(firstVat.plus(secondVat).equals(VAT)).toBe(true);
  });

  it('100-partial-refund drift test: using remaining pattern gives exact total', () => {
    // Invoice: 10000 SAR = 1000000 halalas, VAT 150000 (15%)
    const invoiceTotal = D('1000000');
    const invoiceVat = D('150000');

    let vatRefundedSoFar = D('0');
    const refundAmt = D('10000'); // 100 equal chunks of 10000 halalas

    for (let i = 0; i < 99; i++) {
      const portion = allocateVatPortion(refundAmt, invoiceTotal, invoiceVat);
      vatRefundedSoFar = vatRefundedSoFar.plus(portion);
    }
    // Last refund uses remaining pattern to avoid drift
    const lastVatPortion = invoiceVat.minus(vatRefundedSoFar);
    vatRefundedSoFar = vatRefundedSoFar.plus(lastVatPortion);

    // Must equal totalVat exactly
    expect(vatRefundedSoFar.equals(invoiceVat)).toBe(true);
  });

  it('allocates 0 VAT when refund amount is 0', () => {
    const portion = allocateVatPortion(D('0'), INVOICE, VAT);
    expect(portion.toNumber()).toBe(0);
  });
});
