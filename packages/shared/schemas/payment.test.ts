import { describe, it, expect } from 'vitest'
import {
  paymentMethodSchema,
  paymentStatusSchema,
  processPaymentSchema,
  refundPaymentSchema,
  verifyPaymentSchema,
} from './payment'

describe('paymentMethodSchema', () => {
  it.each(['MOYASAR', 'BANK_TRANSFER', 'CASH'] as const)('accepts "%s"', (value) => {
    expect(paymentMethodSchema.safeParse(value).success).toBe(true)
  })

  it('rejects an unknown payment method', () => {
    const r = paymentMethodSchema.safeParse('CRYPTO')
    expect(r.success).toBe(false)
  })

  it('rejects a lowercase payment method (case-sensitive)', () => {
    const r = paymentMethodSchema.safeParse('cash')
    expect(r.success).toBe(false)
  })
})

describe('paymentStatusSchema', () => {
  it.each([
    'PENDING',
    'PENDING_VERIFICATION',
    'COMPLETED',
    'FAILED',
    'REFUNDED',
  ] as const)('accepts "%s"', (value) => {
    expect(paymentStatusSchema.safeParse(value).success).toBe(true)
  })

  it('rejects an unknown status', () => {
    const r = paymentStatusSchema.safeParse('UNKNOWN')
    expect(r.success).toBe(false)
  })

  it('rejects a lowercase status (case-sensitive)', () => {
    const r = paymentStatusSchema.safeParse('completed')
    expect(r.success).toBe(false)
  })
})

describe('processPaymentSchema', () => {
  it('accepts a valid process payment payload', () => {
    const r = processPaymentSchema.safeParse({
      invoiceId: '550e8400-e29b-41d4-a716-446655440000',
      method: 'MOYASAR',
      amount: 15000,
    })
    expect(r.success).toBe(true)
  })

  it('rejects a non-uuid invoiceId', () => {
    const r = processPaymentSchema.safeParse({
      invoiceId: 'not-a-uuid',
      method: 'MOYASAR',
      amount: 15000,
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('invoiceId')
  })

  it('rejects an out-of-enum method', () => {
    const r = processPaymentSchema.safeParse({
      invoiceId: '550e8400-e29b-41d4-a716-446655440000',
      method: 'CRYPTO',
      amount: 15000,
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('method')
  })

  it('rejects a zero amount', () => {
    const r = processPaymentSchema.safeParse({
      invoiceId: '550e8400-e29b-41d4-a716-446655440000',
      method: 'MOYASAR',
      amount: 0,
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('amount')
  })

  it('rejects a negative amount', () => {
    const r = processPaymentSchema.safeParse({
      invoiceId: '550e8400-e29b-41d4-a716-446655440000',
      method: 'MOYASAR',
      amount: -100,
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('amount')
  })

  it('rejects a non-integer amount (halalas must be integer)', () => {
    const r = processPaymentSchema.safeParse({
      invoiceId: '550e8400-e29b-41d4-a716-446655440000',
      method: 'MOYASAR',
      amount: 99.5,
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('amount')
  })

  it('rejects a string amount (wrong type)', () => {
    const r = processPaymentSchema.safeParse({
      invoiceId: '550e8400-e29b-41d4-a716-446655440000',
      method: 'MOYASAR',
      amount: '15000',
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('amount')
  })
})

describe('refundPaymentSchema', () => {
  it('accepts a valid refund payload without amount (full refund)', () => {
    const r = refundPaymentSchema.safeParse({ reason: 'Customer requested refund' })
    expect(r.success).toBe(true)
  })

  it('accepts a valid partial refund payload', () => {
    const r = refundPaymentSchema.safeParse({ reason: 'Partial refund', amount: 5000 })
    expect(r.success).toBe(true)
  })

  it('rejects an empty reason', () => {
    const r = refundPaymentSchema.safeParse({ reason: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('reason')
  })

  it('rejects a reason longer than 500 characters', () => {
    const r = refundPaymentSchema.safeParse({ reason: 'x'.repeat(501) })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('reason')
  })

  it('rejects a zero amount when provided', () => {
    const r = refundPaymentSchema.safeParse({ reason: 'Refund', amount: 0 })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('amount')
  })

  it('rejects a negative amount when provided', () => {
    const r = refundPaymentSchema.safeParse({ reason: 'Refund', amount: -100 })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('amount')
  })
})

describe('verifyPaymentSchema', () => {
  it.each(['approve', 'reject'] as const)('accepts action="%s"', (action) => {
    const r = verifyPaymentSchema.safeParse({ action })
    expect(r.success).toBe(true)
  })

  it('accepts approve with a transferRef', () => {
    const r = verifyPaymentSchema.safeParse({ action: 'approve', transferRef: 'TRF-12345' })
    expect(r.success).toBe(true)
  })

  it('rejects an out-of-enum action', () => {
    const r = verifyPaymentSchema.safeParse({ action: 'maybe' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('action')
  })

  it('rejects an uppercase action (case-sensitive)', () => {
    const r = verifyPaymentSchema.safeParse({ action: 'APPROVE' })
    expect(r.success).toBe(false)
  })

  it('rejects a missing action', () => {
    const r = verifyPaymentSchema.safeParse({})
    expect(r.success).toBe(false)
  })
})