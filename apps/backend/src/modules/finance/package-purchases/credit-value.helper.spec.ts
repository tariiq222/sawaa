import {
  allocatePurchaseNet,
  remainingCreditValue,
} from './credit-value.helper';

describe('remainingCreditValue', () => {
  it('splits the net value evenly and keeps the rounding remainder on the last session', () => {
    // 175,000 halalas over 6 sessions → 29,166 × 5 + 29,170
    expect(remainingCreditValue({ netValue: 175_000, totalQuantity: 6, usedQuantity: 0 })).toBe(175_000);
    expect(remainingCreditValue({ netValue: 175_000, totalQuantity: 6, usedQuantity: 1 })).toBe(145_834);
    expect(remainingCreditValue({ netValue: 175_000, totalQuantity: 6, usedQuantity: 5 })).toBe(29_170);
  });

  it('returns zero once every session is used, and never goes negative', () => {
    expect(remainingCreditValue({ netValue: 175_000, totalQuantity: 6, usedQuantity: 6 })).toBe(0);
    expect(remainingCreditValue({ netValue: 175_000, totalQuantity: 6, usedQuantity: 9 })).toBe(0);
  });

  it('handles a zero-value (fully discounted) credit', () => {
    expect(remainingCreditValue({ netValue: 0, totalQuantity: 2, usedQuantity: 0 })).toBe(0);
  });
});

describe('allocatePurchaseNet', () => {
  it('gives a single-credit purchase the whole amount', () => {
    expect(
      allocatePurchaseNet(175_000, [{ unitPriceSnapshot: 40_000, totalQuantity: 6 }]),
    ).toEqual([175_000]);
  });

  it('allocates proportionally to list value and puts the remainder on the last credit', () => {
    // gross 300,000 and 30,000 → shares of 210,000
    const shares = allocatePurchaseNet(210_000, [
      { unitPriceSnapshot: 50_000, totalQuantity: 6 },
      { unitPriceSnapshot: 15_000, totalQuantity: 2 },
    ]);
    expect(shares).toEqual([190_909, 19_091]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(210_000);
  });

  it('splits evenly when every credit has zero list value', () => {
    expect(
      allocatePurchaseNet(1_001, [
        { unitPriceSnapshot: 0, totalQuantity: 1 },
        { unitPriceSnapshot: 0, totalQuantity: 1 },
      ]),
    ).toEqual([500, 501]);
  });
});
