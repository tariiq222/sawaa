import { RefundType } from '@prisma/client';
import { computeRefundType, computeRefundAmountHalalas } from './cancellation-policy';

describe('computeRefundType — refund percent', () => {
  const in48h = () => new Date(Date.now() + 48 * 3_600_000);
  const in10h = () => new Date(Date.now() + 10 * 3_600_000);

  it('FULL within free window → 100%', () => {
    const r = computeRefundType({
      scheduledAt: in48h(),
      freeCancelBeforeHours: 24,
      freeCancelRefundType: RefundType.FULL,
      lateCancelRefundPercent: 50,
    });
    expect(r.refundType).toBe(RefundType.FULL);
    expect(r.refundPercent).toBe(100);
    expect(r.isWithinFreeWindow).toBe(true);
  });

  it('PARTIAL within free window uses lateCancelRefundPercent', () => {
    const r = computeRefundType({
      scheduledAt: in48h(),
      freeCancelBeforeHours: 24,
      freeCancelRefundType: RefundType.PARTIAL,
      lateCancelRefundPercent: 50,
    });
    expect(r.refundType).toBe(RefundType.PARTIAL);
    expect(r.refundPercent).toBe(50);
  });

  it('PARTIAL with 0% degrades to NONE (no zero-amount refund)', () => {
    const r = computeRefundType({
      scheduledAt: in48h(),
      freeCancelBeforeHours: 24,
      freeCancelRefundType: RefundType.PARTIAL,
      lateCancelRefundPercent: 0,
    });
    expect(r.refundType).toBe(RefundType.NONE);
    expect(r.refundPercent).toBe(0);
  });

  it('late cancel with lateCancelRefundPercent=0 → NONE (full forfeiture)', () => {
    const r = computeRefundType({
      scheduledAt: in10h(),
      freeCancelBeforeHours: 24,
      freeCancelRefundType: RefundType.FULL,
      lateCancelRefundPercent: 0,
    });
    expect(r.refundType).toBe(RefundType.NONE);
    expect(r.refundPercent).toBe(0);
    expect(r.isWithinFreeWindow).toBe(false);
  });

  it('late cancel with lateCancelRefundPercent=50 → PARTIAL 50%', () => {
    const r = computeRefundType({
      scheduledAt: in10h(),
      freeCancelBeforeHours: 24,
      freeCancelRefundType: RefundType.FULL,
      lateCancelRefundPercent: 50,
    });
    expect(r.refundType).toBe(RefundType.PARTIAL);
    expect(r.refundPercent).toBe(50);
  });

  it('late cancel with lateCancelRefundPercent=100 → FULL', () => {
    const r = computeRefundType({
      scheduledAt: in10h(),
      freeCancelBeforeHours: 24,
      freeCancelRefundType: RefundType.NONE,
      lateCancelRefundPercent: 100,
    });
    expect(r.refundType).toBe(RefundType.FULL);
    expect(r.refundPercent).toBe(100);
  });

  it('clamps out-of-range / fractional percent to integer [0,100]', () => {
    expect(
      computeRefundType({
        scheduledAt: in10h(),
        freeCancelBeforeHours: 24,
        freeCancelRefundType: RefundType.FULL,
        lateCancelRefundPercent: 33.7,
      }).refundPercent,
    ).toBe(34);
    expect(
      computeRefundType({
        scheduledAt: in10h(),
        freeCancelBeforeHours: 24,
        freeCancelRefundType: RefundType.FULL,
        lateCancelRefundPercent: 150,
      }).refundPercent,
    ).toBe(100);
  });

  it('defaults lateCancelRefundPercent to 0 when undefined (back-compat)', () => {
    const r = computeRefundType({
      scheduledAt: in10h(),
      freeCancelBeforeHours: 24,
      freeCancelRefundType: RefundType.FULL,
    });
    expect(r.refundType).toBe(RefundType.NONE);
    expect(r.refundPercent).toBe(0);
  });
});

describe('computeRefundAmountHalalas — exact integer halalas', () => {
  it('100% returns the full paid amount', () => {
    expect(computeRefundAmountHalalas(10_000, 100)).toBe(10_000);
  });

  it('0% returns 0', () => {
    expect(computeRefundAmountHalalas(10_000, 0)).toBe(0);
  });

  it('50% of 10000 halalas = 5000', () => {
    expect(computeRefundAmountHalalas(10_000, 50)).toBe(5_000);
  });

  it('rounds to the nearest whole halala (never fractional)', () => {
    // 33% of 10001 = 3300.33 → 3300
    const r = computeRefundAmountHalalas(10_001, 33);
    expect(Number.isInteger(r)).toBe(true);
    expect(r).toBe(3300);
  });

  it('rounds half-up (51% of 9999 = 5099.49 → 5099)', () => {
    expect(computeRefundAmountHalalas(9_999, 51)).toBe(5099);
  });

  it('rounds half-up (50% of 999 = 499.5 → 500)', () => {
    const r = computeRefundAmountHalalas(999, 50);
    expect(Number.isInteger(r)).toBe(true);
    expect(r).toBe(500);
  });

  it('clamps percent above 100 to the full amount', () => {
    expect(computeRefundAmountHalalas(7_777, 250)).toBe(7_777);
  });

  it('treats a fractional input paid amount as rounded halalas', () => {
    expect(computeRefundAmountHalalas(100.6, 100)).toBe(101);
  });
});
