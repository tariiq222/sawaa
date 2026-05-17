import { describe, it, expect } from 'vitest';
import {
  HALALAS_PER_SAR,
  sarToHalalas,
  halalasToSar,
  formatHalalas,
  isValidHalalas,
} from './index';

describe('money', () => {
  it('HALALAS_PER_SAR is 100', () => {
    expect(HALALAS_PER_SAR).toBe(100);
  });

  it('sarToHalalas converts and rounds to integer halalas', () => {
    expect(sarToHalalas(120)).toBe(12000);
    expect(sarToHalalas(0.1)).toBe(10);
    expect(sarToHalalas(49.999)).toBe(5000);
  });

  it('halalasToSar returns a SAR-major number', () => {
    expect(halalasToSar(12000)).toBe(120);
    expect(halalasToSar(10)).toBe(0.1);
  });

  it('formatHalalas renders a SAR string with 2 decimals', () => {
    expect(formatHalalas(12000, { locale: 'en' })).toBe('120.00');
    expect(formatHalalas(0, { locale: 'en' })).toBe('0.00');
  });

  it('isValidHalalas rejects non-integers and negatives', () => {
    expect(isValidHalalas(12000)).toBe(true);
    expect(isValidHalalas(0)).toBe(true);
    expect(isValidHalalas(120.5)).toBe(false);
    expect(isValidHalalas(-1)).toBe(false);
    expect(isValidHalalas(Number.NaN)).toBe(false);
  });
});
