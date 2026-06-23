import { describe, it, expect } from 'vitest'
import {
  phoneRegex,
  saudiPhoneRegex,
  createClientSchema,
  updateClientSchema,
} from './client'

function validClient() {
  return {
    firstName: 'سامي',
    lastName: 'العمري',
    phone: '+966501234567',
    email: 'sami@example.com',
  }
}

describe('phoneRegex', () => {
  it('accepts an E.164-like phone with country code and 7-15 digits', () => {
    expect(phoneRegex.test('+966501234567')).toBe(true)
    expect(phoneRegex.test('+12025550100')).toBe(true)
    expect(phoneRegex.test('+447911123456')).toBe(true)
  })

  it('rejects a phone without leading +', () => {
    expect(phoneRegex.test('966501234567')).toBe(false)
    expect(phoneRegex.test('0501234567')).toBe(false)
  })

  it('rejects a phone with a leading 0 after +', () => {
    expect(phoneRegex.test('+0501234567')).toBe(false)
  })

  it('rejects a phone that is too short', () => {
    expect(phoneRegex.test('+12345')).toBe(false)
  })

  it('rejects a phone that is too long', () => {
    expect(phoneRegex.test('+12345678901234567890')).toBe(false)
  })
})

describe('saudiPhoneRegex', () => {
  it('accepts the international Saudi mobile format +9665XXXXXXXX', () => {
    expect(saudiPhoneRegex.test('+966501234567')).toBe(true)
    expect(saudiPhoneRegex.test('+966559876543')).toBe(true)
  })

  it('rejects the local Saudi mobile format 05XXXXXXXX (missing +966)', () => {
    expect(saudiPhoneRegex.test('0501234567')).toBe(false)
  })

  it('rejects a Saudi phone with the wrong prefix after +966', () => {
    expect(saudiPhoneRegex.test('+966401234567')).toBe(false)
    expect(saudiPhoneRegex.test('+966601234567')).toBe(false)
  })

  it('rejects a Saudi phone with the wrong total length', () => {
    expect(saudiPhoneRegex.test('+96650123456')).toBe(false)
    expect(saudiPhoneRegex.test('+9665012345678')).toBe(false)
  })
})

describe('createClientSchema', () => {
  it('accepts a minimal valid client (firstName + lastName only)', () => {
    const r = createClientSchema.safeParse({ firstName: 'A', lastName: 'B' })
    expect(r.success).toBe(true)
  })

  it('accepts a fully populated client', () => {
    const r = createClientSchema.safeParse({
      ...validClient(),
      nationalId: '1234567890',
      dateOfBirth: '1990-05-15',
      gender: 'MALE',
      nationality: 'SA',
      bloodType: 'O+',
      allergies: 'None',
      chronicConditions: 'None',
      emergencyContactName: 'Father',
      emergencyContactPhone: '+966501234567',
    })
    expect(r.success).toBe(true)
  })

  it('rejects an empty firstName', () => {
    const r = createClientSchema.safeParse({ firstName: '', lastName: 'B' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('firstName')
  })

  it('rejects an empty lastName', () => {
    const r = createClientSchema.safeParse({ firstName: 'A', lastName: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('lastName')
  })

  it('rejects a firstName longer than 100 characters', () => {
    const r = createClientSchema.safeParse({ firstName: 'x'.repeat(101), lastName: 'B' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('firstName')
  })

  it('rejects a lastName longer than 100 characters', () => {
    const r = createClientSchema.safeParse({ firstName: 'A', lastName: 'x'.repeat(101) })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('lastName')
  })

  it('rejects a phone in the local 05XXXXXXXX format (no +966)', () => {
    const r = createClientSchema.safeParse({
      firstName: 'A',
      lastName: 'B',
      phone: '0501234567',
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('phone')
  })

  it('rejects an invalid email', () => {
    const r = createClientSchema.safeParse({
      firstName: 'A',
      lastName: 'B',
      email: 'not-an-email',
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('email')
  })

  it('rejects a dateOfBirth not in YYYY-MM-DD format', () => {
    const r = createClientSchema.safeParse({
      firstName: 'A',
      lastName: 'B',
      dateOfBirth: '15-05-1990',
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('dateOfBirth')
  })

  it('rejects an out-of-enum gender', () => {
    const r = createClientSchema.safeParse({
      firstName: 'A',
      lastName: 'B',
      gender: 'OTHER',
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('gender')
  })

  it('rejects a nationalId longer than 20 characters', () => {
    const r = createClientSchema.safeParse({
      firstName: 'A',
      lastName: 'B',
      nationalId: 'x'.repeat(21),
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('nationalId')
  })

  it('rejects allergies longer than 1000 characters', () => {
    const r = createClientSchema.safeParse({
      firstName: 'A',
      lastName: 'B',
      allergies: 'x'.repeat(1001),
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('allergies')
  })

  it('rejects chronicConditions longer than 1000 characters', () => {
    const r = createClientSchema.safeParse({
      firstName: 'A',
      lastName: 'B',
      chronicConditions: 'x'.repeat(1001),
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('chronicConditions')
  })

  it('rejects an emergencyContactPhone in the local format', () => {
    const r = createClientSchema.safeParse({
      firstName: 'A',
      lastName: 'B',
      emergencyContactPhone: '0501234567',
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('emergencyContactPhone')
  })
})

describe('updateClientSchema', () => {
  it('accepts an empty payload (all fields optional via .partial())', () => {
    const r = updateClientSchema.safeParse({})
    expect(r.success).toBe(true)
  })

  it('accepts a single-field update', () => {
    const r = updateClientSchema.safeParse({ firstName: 'NewName' })
    expect(r.success).toBe(true)
  })

  it('still enforces validation on fields that ARE provided', () => {
    const r = updateClientSchema.safeParse({ phone: '0501234567' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('phone')
  })

  it('still enforces min(1) on firstName when provided', () => {
    const r = updateClientSchema.safeParse({ firstName: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('firstName')
  })

  it('still enforces max(100) on lastName when provided', () => {
    const r = updateClientSchema.safeParse({ lastName: 'x'.repeat(101) })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('lastName')
  })
})