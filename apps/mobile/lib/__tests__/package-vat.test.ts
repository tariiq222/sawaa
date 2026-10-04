import { packageGrossHalalas, packageVatHalalas, packageVatRate, purchaseChargedHalalas } from '../package-vat';

describe('package VAT helpers', () => {
  it('leaves the price unchanged when the rate is 0 or missing', () => {
    expect(packageGrossHalalas(36000, 0)).toBe(36000);
    expect(packageVatHalalas(36000, 0)).toBe(0);
    expect(packageVatRate({})).toBe(0);
    expect(packageVatRate(undefined)).toBe(0);
    expect(packageVatRate({ vatRate: null })).toBe(0);
    expect(packageVatRate({ vatRate: -0.1 })).toBe(0);
    expect(packageVatRate({ vatRate: Number.NaN })).toBe(0);
  });

  it('adds VAT on top of the net price', () => {
    expect(packageVatRate({ vatRate: 0.15 })).toBe(0.15);
    expect(packageVatHalalas(36000, 0.15)).toBe(5400);
    expect(packageGrossHalalas(36000, 0.15)).toBe(41400);
  });

  it('rounds half up to whole halalas like the backend', () => {
    expect(packageVatHalalas(10, 0.15)).toBe(2); // 1.5 -> 2
    expect(packageVatHalalas(13, 0.15)).toBe(2); // 1.95 -> 2
    expect(packageVatHalalas(3, 0.15)).toBe(0); // 0.45 -> 0
    expect(packageGrossHalalas(0, 0.15)).toBe(0);
  });

  it('prefers the VAT-inclusive charged total on purchase rows', () => {
    expect(purchaseChargedHalalas({ amountPaid: 36000, totalCharged: 41400 })).toBe(41400);
    expect(purchaseChargedHalalas({ amountPaid: 36000 })).toBe(36000);
    expect(purchaseChargedHalalas({ amountPaid: 36000, totalCharged: null })).toBe(36000);
  });
});
