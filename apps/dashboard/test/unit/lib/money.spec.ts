import { describe, it, expect } from 'vitest'
import { formatPrice, sarToHalalas, halalasToSarNumber, halalasToSar } from '@/lib/money'

// Note: In apps/dashboard, halalasToSar returns a number (established API).
// halalasToSarNumber is an alias for it.
// For string formatting, use formatPrice from the same module.

describe('sarToHalalas', () => {
  it('converts whole SAR', () => { expect(sarToHalalas(100)).toBe(10000) })
  it('converts fractional SAR', () => { expect(sarToHalalas(99.5)).toBe(9950) })
  it('rounds floating-point imprecision', () => { expect(sarToHalalas(0.1 + 0.2)).toBe(30) })
  it('handles zero', () => { expect(sarToHalalas(0)).toBe(0) })
})

describe('halalasToSarNumber', () => {
  it('returns a number', () => { expect(halalasToSarNumber(9950)).toBe(99.5) })
  it('returns 0 for zero', () => { expect(halalasToSarNumber(0)).toBe(0) })
})

describe('halalasToSar', () => {
  it('null input returns 0', () => { expect(halalasToSar(null)).toBe(0) })
  it('undefined input returns 0', () => { expect(halalasToSar(undefined)).toBe(0) })
  it('normal conversion: 10000 halalas returns 100 SAR', () => { expect(halalasToSar(10000)).toBe(100) })
})

describe('formatPrice', () => {
  it('formats halalas as SAR string with default 2 decimals', () => {
    expect(formatPrice(15000)).toBe('150.00')
    expect(formatPrice(99)).toBe('0.99')
  })

  it('respects decimals option', () => {
    expect(formatPrice(15000, { decimals: 0 })).toBe('150')
    expect(formatPrice(15050, { decimals: 0 })).toBe('151')
  })

  it('returns em-dash for null/undefined', () => {
    expect(formatPrice(null)).toBe('—')
    expect(formatPrice(undefined)).toBe('—')
  })

  it('uses latn digits for both locales', () => {
    // Both should produce ASCII digits (we force -u-nu-latn for AR)
    expect(formatPrice(15000, { locale: 'ar' })).toMatch(/^[\d.,]+$/)
    expect(formatPrice(15000, { locale: 'en' })).toMatch(/^[\d.,]+$/)
  })
})
