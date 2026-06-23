import { describe, it, expect } from 'vitest'
import { findDepartment } from './find-department'

describe('findDepartment', () => {
  const departments = [
    { nameAr: 'عيادات سواء', nameEn: 'Sawaa Clinics' },
    { nameAr: 'قسم الأطفال', nameEn: 'Pediatrics' },
    { nameAr: 'قسم النساء', nameEn: 'OB-GYN' },
    { nameAr: 'مختبر التحاليل', nameEn: 'Laboratory' },
  ]

  it('matches by Arabic substring (exact match)', () => {
    const result = findDepartment(departments, {
      ar: ['عيادات سواء'],
      en: [],
    })
    expect(result).toBe(departments[0])
  })

  it('matches by Arabic substring (partial keyword)', () => {
    const result = findDepartment(departments, {
      ar: ['الأطفال'],
      en: [],
    })
    expect(result).toBe(departments[1])
  })

  it('matches by English substring (lowercase query, mixed-case name)', () => {
    const result = findDepartment(departments, {
      ar: [],
      en: ['pediatrics'],
    })
    expect(result).toBe(departments[1])
  })

  it('matches by English substring case-insensitively (uppercase query)', () => {
    const result = findDepartment(departments, {
      ar: [],
      en: ['OB-GYN'],
    })
    // Query is uppercased, name is uppercased — must match.
    expect(result).toBe(departments[2])
  })

  it('matches by English substring case-insensitively (lowercase query, uppercase name)', () => {
    const result = findDepartment(departments, {
      ar: [],
      en: ['laboratory'],
    })
    // Name "Laboratory" lowercased → contains "laboratory".
    expect(result).toBe(departments[3])
  })

  it('returns undefined when no keyword matches either language', () => {
    const result = findDepartment(departments, {
      ar: ['غير موجود'],
      en: ['nonexistent'],
    })
    expect(result).toBeUndefined()
  })

  it('returns undefined when departments array is empty', () => {
    const result = findDepartment([], { ar: ['عيادات'], en: ['clinic'] })
    expect(result).toBeUndefined()
  })

  it('skips a department whose nameEn is null and falls through to the next', () => {
    const depts = [
      { nameAr: 'قسم بلا اسم', nameEn: null as string | null },
      { nameAr: 'قسم الأطفال', nameEn: 'Pediatrics' },
    ]
    const result = findDepartment(depts, { ar: [], en: ['pediatrics'] })
    expect(result).toBe(depts[1])
  })

  it('returns undefined when only nameEn is null and Arabic does not match', () => {
    const depts = [{ nameAr: 'قسم بلا اسم', nameEn: null as string | null }]
    const result = findDepartment(depts, { ar: [], en: ['pediatrics'] })
    expect(result).toBeUndefined()
  })

  it('with empty keywords on both sides, matches nothing', () => {
    const result = findDepartment(departments, { ar: [], en: [] })
    expect(result).toBeUndefined()
  })

  it('matches the first department when multiple match', () => {
    const result = findDepartment(departments, {
      ar: [],
      en: ['a'], // 'a' appears in "Sawaa Clinics", "Pediatrics", "OB-GYN" — should pick first
    })
    expect(result).toBe(departments[0])
  })
})