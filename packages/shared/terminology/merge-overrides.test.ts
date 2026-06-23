import { describe, it, expect } from 'vitest'
import {
  mergeOverrides,
  BASE_PACKS,
  TEMPLATE_FAMILIES,
  TERMINOLOGY_KEYS,
  type TemplateFamily,
  type TerminologyPack,
} from './index'

describe('mergeOverrides', () => {
  const base: TerminologyPack = BASE_PACKS.MEDICAL

  it('returns a new pack equal to base when overrides is empty (identity)', () => {
    const out = mergeOverrides(base, [])
    expect(out).toEqual(base)
    // Identity in semantics — keys/values are unchanged.
    for (const key of TERMINOLOGY_KEYS) {
      expect(out[key]).toEqual(base[key])
    }
  })

  it('override wins for a known key', () => {
    const out = mergeOverrides(base, [
      { tokenKey: 'employee.singular', valueAr: 'طبيب استشاري', valueEn: 'Consultant Doctor' },
    ])
    expect(out['employee.singular']).toEqual({
      ar: 'طبيب استشاري',
      en: 'Consultant Doctor',
    })
    // All other keys are unchanged.
    expect(out['client.singular']).toEqual(base['client.singular'])
    expect(out['booking.singular']).toEqual(base['booking.singular'])
  })

  it('does not mutate the base pack', () => {
    const originalAr = base['employee.singular'].ar
    mergeOverrides(base, [
      { tokenKey: 'employee.singular', valueAr: 'مختلف', valueEn: 'Different' },
    ])
    expect(base['employee.singular'].ar).toBe(originalAr)
  })

  it('ignores overrides whose tokenKey is not in TERMINOLOGY_KEYS (falls back to base)', () => {
    const out = mergeOverrides(base, [
      { tokenKey: 'unknown.key', valueAr: 'تجاهل', valueEn: 'Ignored' },
    ])
    expect(out).toEqual(base)
    // No key outside the catalog was injected.
    expect(Object.keys(out).sort()).toEqual([...TERMINOLOGY_KEYS].sort())
  })

  it('falls back to base for any key that has no override (missing key = no change)', () => {
    const out = mergeOverrides(base, [
      // only employee.singular is overridden
      { tokenKey: 'employee.singular', valueAr: 'X', valueEn: 'X' },
    ])
    // every other key remains equal to base
    for (const key of TERMINOLOGY_KEYS) {
      if (key === 'employee.singular') continue
      expect(out[key]).toEqual(base[key])
    }
  })

  it('applies multiple overrides in order', () => {
    const out = mergeOverrides(base, [
      { tokenKey: 'employee.singular', valueAr: 'A', valueEn: 'A' },
      { tokenKey: 'client.singular', valueAr: 'B', valueEn: 'B' },
    ])
    expect(out['employee.singular']).toEqual({ ar: 'A', en: 'A' })
    expect(out['client.singular']).toEqual({ ar: 'B', en: 'B' })
    expect(out['booking.singular']).toEqual(base['booking.singular'])
  })

  it('when an override key is repeated, the last write wins', () => {
    const out = mergeOverrides(base, [
      { tokenKey: 'employee.singular', valueAr: 'First', valueEn: 'First' },
      { tokenKey: 'employee.singular', valueAr: 'Last', valueEn: 'Last' },
    ])
    expect(out['employee.singular']).toEqual({ ar: 'Last', en: 'Last' })
  })

  it('ignores overrides for every key if none are recognized', () => {
    const out = mergeOverrides(base, [
      { tokenKey: 'foo.bar', valueAr: 'x', valueEn: 'x' },
      { tokenKey: 'baz.qux', valueAr: 'y', valueEn: 'y' },
    ])
    expect(out).toEqual(base)
  })

  it('result has the same shape as base — same keys, TerminologyValue values', () => {
    const out = mergeOverrides(base, [
      { tokenKey: 'employee.singular', valueAr: 'X', valueEn: 'X' },
    ])
    expect(Object.keys(out).sort()).toEqual([...TERMINOLOGY_KEYS].sort())
    for (const key of TERMINOLOGY_KEYS) {
      expect(out[key]).toHaveProperty('ar')
      expect(out[key]).toHaveProperty('en')
      expect(typeof out[key].ar).toBe('string')
      expect(typeof out[key].en).toBe('string')
    }
  })

  it('works against every base family pack without throwing', () => {
    for (const family of TEMPLATE_FAMILIES as readonly TemplateFamily[]) {
      const familyBase = BASE_PACKS[family]
      const out = mergeOverrides(familyBase, [
        { tokenKey: 'employee.singular', valueAr: 'X', valueEn: 'X' },
      ])
      expect(out['employee.singular']).toEqual({ ar: 'X', en: 'X' })
      expect(out['booking.singular']).toEqual(familyBase['booking.singular'])
    }
  })
})