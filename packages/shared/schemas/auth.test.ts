import { describe, it, expect } from 'vitest'
import {
  loginSchema,
  changePasswordSchema,
  passwordResetRequestSchema,
  passwordResetPerformSchema,
} from './auth'

describe('loginSchema', () => {
  it('accepts a valid login payload', () => {
    const r = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'supersecret',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.rememberMe).toBeUndefined()
    }
  })

  it('accepts rememberMe=true when provided', () => {
    const r = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'supersecret',
      rememberMe: true,
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.rememberMe).toBe(true)
  })

  it('rejects an invalid email', () => {
    const r = loginSchema.safeParse({ email: 'not-an-email', password: 'supersecret' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].path).toContain('email')
    }
  })

  it('rejects a password shorter than 8 characters', () => {
    const r = loginSchema.safeParse({ email: 'user@example.com', password: 'short' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].path).toContain('password')
    }
  })

  it('rejects missing email and password fields', () => {
    const r = loginSchema.safeParse({})
    expect(r.success).toBe(false)
    if (!r.success) {
      const paths = r.error.issues.map((i) => i.path[0])
      expect(paths).toContain('email')
      expect(paths).toContain('password')
    }
  })
})

describe('changePasswordSchema', () => {
  it('accepts a valid password change payload', () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: 'old-secret',
      newPassword: 'NewSecret1',
    })
    expect(r.success).toBe(true)
  })

  it('rejects an empty currentPassword', () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: '',
      newPassword: 'NewSecret1',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].path).toContain('currentPassword')
    }
  })

  it('rejects a newPassword shorter than 8 characters', () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: 'old-secret',
      newPassword: 'Ab1',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].path).toContain('newPassword')
    }
  })

  it('rejects a newPassword without an uppercase letter', () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: 'old-secret',
      newPassword: 'alllower1',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].path).toContain('newPassword')
      expect(r.error.issues[0].message).toMatch(/uppercase/i)
    }
  })

  it('rejects a newPassword without a digit', () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: 'old-secret',
      newPassword: 'NoDigitsHere',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].path).toContain('newPassword')
      expect(r.error.issues[0].message).toMatch(/digit/i)
    }
  })
})

describe('passwordResetRequestSchema', () => {
  it('accepts a valid email', () => {
    const r = passwordResetRequestSchema.safeParse({ email: 'user@example.com' })
    expect(r.success).toBe(true)
  })

  it('rejects an invalid email', () => {
    const r = passwordResetRequestSchema.safeParse({ email: 'bad-email' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].path).toContain('email')
    }
  })

  it('rejects an empty email', () => {
    const r = passwordResetRequestSchema.safeParse({ email: '' })
    expect(r.success).toBe(false)
  })

  it('rejects a missing email field', () => {
    const r = passwordResetRequestSchema.safeParse({})
    expect(r.success).toBe(false)
  })
})

describe('passwordResetPerformSchema', () => {
  it('accepts a valid reset payload', () => {
    const r = passwordResetPerformSchema.safeParse({
      token: '550e8400-e29b-41d4-a716-446655440000',
      newPassword: 'NewSecret1',
    })
    expect(r.success).toBe(true)
  })

  it('rejects a non-uuid token', () => {
    const r = passwordResetPerformSchema.safeParse({
      token: 'not-a-uuid',
      newPassword: 'NewSecret1',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].path).toContain('token')
    }
  })

  it('rejects a newPassword shorter than 8 characters', () => {
    const r = passwordResetPerformSchema.safeParse({
      token: '550e8400-e29b-41d4-a716-446655440000',
      newPassword: 'short',
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0].path).toContain('newPassword')
    }
  })
})