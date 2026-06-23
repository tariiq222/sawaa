import { describe, it, expect } from 'vitest'
import {
  bookingStatusSchema,
  bookingTypeSchema,
  deliveryTypeSchema,
  createBookingSchema,
  updateBookingSchema,
} from './booking'

function validBooking() {
  return {
    employeeId: '550e8400-e29b-41d4-a716-446655440000',
    serviceId: '660e8400-e29b-41d4-a716-446655440001',
    date: '2026-07-15',
    startTime: '14:30',
  }
}

describe('bookingStatusSchema', () => {
  it.each([
    'pending',
    'pending_group_fill',
    'awaiting_payment',
    'confirmed',
    'cancelled',
    'completed',
    'no_show',
    'expired',
    'cancel_requested',
  ] as const)('accepts "%s"', (value) => {
    expect(bookingStatusSchema.safeParse(value).success).toBe(true)
  })

  it('rejects an unknown status', () => {
    const r = bookingStatusSchema.safeParse('UNKNOWN_STATUS')
    expect(r.success).toBe(false)
  })
})

describe('bookingTypeSchema', () => {
  it.each(['individual', 'walk_in', 'group'] as const)('accepts "%s"', (value) => {
    expect(bookingTypeSchema.safeParse(value).success).toBe(true)
  })

  it('rejects an unknown type', () => {
    const r = bookingTypeSchema.safeParse('group_online')
    expect(r.success).toBe(false)
  })
})

describe('deliveryTypeSchema', () => {
  it.each(['IN_PERSON', 'ONLINE'] as const)('accepts "%s"', (value) => {
    expect(deliveryTypeSchema.safeParse(value).success).toBe(true)
  })

  it('rejects an unknown delivery type', () => {
    const r = deliveryTypeSchema.safeParse('TELEPATHY')
    expect(r.success).toBe(false)
  })

  it('rejects a lowercase delivery type', () => {
    const r = deliveryTypeSchema.safeParse('in_person')
    expect(r.success).toBe(false)
  })
})

describe('createBookingSchema', () => {
  it('accepts a minimal valid booking payload', () => {
    const r = createBookingSchema.safeParse(validBooking())
    expect(r.success).toBe(true)
  })

  it('accepts a fully populated booking payload', () => {
    const r = createBookingSchema.safeParse({
      ...validBooking(),
      type: 'individual',
      deliveryType: 'ONLINE',
      clientId: '770e8400-e29b-41d4-a716-446655440002',
      notes: 'Prefers morning sessions',
      branchId: '880e8400-e29b-41d4-a716-446655440003',
      durationOptionId: '990e8400-e29b-41d4-a716-446655440004',
      payAtClinic: false,
      couponCode: 'SUMMER25',
    })
    expect(r.success).toBe(true)
  })

  it('rejects a non-uuid employeeId', () => {
    const r = createBookingSchema.safeParse({ ...validBooking(), employeeId: 'not-a-uuid' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('employeeId')
  })

  it('rejects a non-uuid serviceId', () => {
    const r = createBookingSchema.safeParse({ ...validBooking(), serviceId: 'svc-1' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('serviceId')
  })

  it('rejects an out-of-enum deliveryType', () => {
    const r = createBookingSchema.safeParse({ ...validBooking(), deliveryType: 'TELEPATHY' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('deliveryType')
  })

  it('rejects a date not in YYYY-MM-DD format', () => {
    const r = createBookingSchema.safeParse({ ...validBooking(), date: '15-07-2026' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('date')
  })

  it('rejects a startTime not in HH:MM format', () => {
    const r = createBookingSchema.safeParse({ ...validBooking(), startTime: '2:30 PM' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('startTime')
  })

  it('rejects notes longer than 2000 characters', () => {
    const r = createBookingSchema.safeParse({ ...validBooking(), notes: 'x'.repeat(2001) })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('notes')
  })
})

describe('updateBookingSchema', () => {
  it('accepts an empty payload (all fields optional)', () => {
    const r = updateBookingSchema.safeParse({})
    expect(r.success).toBe(true)
  })

  it('accepts a valid status update', () => {
    const r = updateBookingSchema.safeParse({ status: 'confirmed' })
    expect(r.success).toBe(true)
  })

  it('accepts a valid adminNotes update', () => {
    const r = updateBookingSchema.safeParse({ adminNotes: 'Rescheduled by admin' })
    expect(r.success).toBe(true)
  })

  it('rejects an unknown status', () => {
    const r = updateBookingSchema.safeParse({ status: 'UNKNOWN_STATUS' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('status')
  })

  it('rejects adminNotes longer than 2000 characters', () => {
    const r = updateBookingSchema.safeParse({ adminNotes: 'x'.repeat(2001) })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('adminNotes')
  })
})