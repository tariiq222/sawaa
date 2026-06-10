import { describe, it, expect } from 'vitest';

import { sarToHalalas, halalasToSar, halalasToSarNumber, grossWithVat } from './money';

describe('money helpers', () => {
  it('sarToHalalas converts SAR to integer halalas', () => {
    expect(sarToHalalas(99.5)).toBe(9950);
    expect(sarToHalalas(0)).toBe(0);
  });

  it('halalasToSar formats with 2 decimal places', () => {
    expect(halalasToSar(9950)).toBe('99.50');
  });

  it('halalasToSarNumber converts to a plain number', () => {
    expect(halalasToSarNumber(9950)).toBe(99.5);
  });

  describe('grossWithVat — parity with backend computeVat (round-half-up)', () => {
    it('10000 halalas at 15% → 11500 (exact)', () => {
      expect(grossWithVat(10000, 0.15)).toBe(11500);
    });

    it('25050 halalas at 15% → 28808 (vat 3757.5 rounds half-up to 3758)', () => {
      expect(grossWithVat(25050, 0.15)).toBe(28808);
    });

    it('9999 halalas at 15% → 11499 (vat 1499.85 rounds to 1500)', () => {
      expect(grossWithVat(9999, 0.15)).toBe(11499);
    });

    it('zero rate is identity', () => {
      expect(grossWithVat(10000, 0)).toBe(10000);
    });

    it('zero amount stays zero', () => {
      expect(grossWithVat(0, 0.15)).toBe(0);
    });
  });
});
