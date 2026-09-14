import { describe, expect, it } from 'vitest'
import {
  globalDiscountSchema,
  groupedPackageInputSchema,
  packageGroupInputSchema,
  packageSessionInputSchema,
} from './session-package-v2'

const serviceA = '00000000-0000-4000-8000-000000000001'
const serviceB = '00000000-0000-4000-8000-000000000002'
const employeeA = '00000000-0000-4000-8000-000000000011'
const employeeB = '00000000-0000-4000-8000-000000000012'
const durationA = '00000000-0000-4000-8000-000000000021'

const session = (overrides: Record<string, unknown> = {}) => ({
  key: 'session-1',
  position: 0,
  durationOptionId: durationA,
  deliveryType: 'IN_PERSON',
  unitPrice: 10_000,
  ...overrides,
})

const group = (overrides: Record<string, unknown> = {}) => ({
  key: 'group-a',
  serviceId: serviceA,
  employeeId: employeeA,
  sequenceMode: 'ORDERED',
  dependsOnGroupKey: null,
  sessions: [session()],
  ...overrides,
})

const payload = (overrides: Record<string, unknown> = {}) => ({
  modelVersion: 'GROUPED_V2',
  groups: [group()],
  globalDiscount: { type: 'NONE', value: 0 },
  ...overrides,
})

describe('packageSessionInputSchema', () => {
  it('accepts registered delivery values, safe money, and the database position maximum', () => {
    expect(packageSessionInputSchema.safeParse(session({
      deliveryType: 'ONLINE',
      position: 2_147_483_647,
      unitPrice: Number.MAX_SAFE_INTEGER,
    })).success).toBe(true)
  })

  it('rejects malformed UUIDs, delivery values, money, and out of range positions', () => {
    for (const field of [
      { durationOptionId: 'not-a-uuid' },
      { deliveryType: 'TELEPORT' },
      { unitPrice: -1 },
      { unitPrice: 1.5 },
      { unitPrice: Number.MAX_SAFE_INTEGER + 1 },
      { position: -1 },
      { position: 1.5 },
      { position: 2_147_483_648 },
    ]) {
      expect(packageSessionInputSchema.safeParse(session(field)).success).toBe(false)
    }
  })
})

describe('globalDiscountSchema', () => {
  it('accepts NONE, percentage, and fixed halala variants', () => {
    expect(globalDiscountSchema.safeParse({ type: 'NONE', value: 0 }).success).toBe(true)
    expect(globalDiscountSchema.safeParse({ type: 'PERCENTAGE', value: 0 }).success).toBe(true)
    expect(globalDiscountSchema.safeParse({ type: 'PERCENTAGE', value: 100 }).success).toBe(true)
    expect(globalDiscountSchema.safeParse({ type: 'PERCENTAGE', value: 12.5 }).success).toBe(true)
    expect(globalDiscountSchema.safeParse({ type: 'FIXED', value: 1 }).success).toBe(true)
  })

  it('rejects invalid discriminants and discount bounds', () => {
    for (const discount of [
      { type: 'NONE', value: 1 },
      { type: 'PERCENTAGE', value: -1 },
      { type: 'PERCENTAGE', value: 101 },
      { type: 'FIXED', value: -1 },
      { type: 'FIXED', value: 1.5 },
      { type: 'FIXED', value: Number.MAX_SAFE_INTEGER + 1 },
      { type: 'UNKNOWN', value: 0 },
    ]) {
      expect(globalDiscountSchema.safeParse(discount).success).toBe(false)
    }
  })
})

describe('groupedPackageInputSchema graph policy', () => {
  it('accepts multiple practitioners, mixed delivery, and contiguous sessions', () => {
    const result = groupedPackageInputSchema.safeParse(payload({
      groups: [
        group({
          sessions: [session(), session({ key: 'session-2', position: 1, deliveryType: 'ONLINE' })],
        }),
        group({
          key: 'group-b',
          serviceId: serviceB,
          employeeId: employeeB,
          sequenceMode: 'UNORDERED',
          dependsOnGroupKey: 'group-a',
        }),
      ],
      globalDiscount: { type: 'PERCENTAGE', value: 10 },
    }))
    expect(result.success).toBe(true)
  })

  it('rejects empty groups and invalid group UUIDs through the full schema', () => {
    expect(groupedPackageInputSchema.safeParse(payload({ groups: [] })).success).toBe(false)
    expect(packageGroupInputSchema.safeParse(group({ sessions: [] })).success).toBe(false)
    expect(groupedPackageInputSchema.safeParse(payload({
      groups: [group({ employeeId: 'invalid' })],
    })).success).toBe(false)
  })

  it('rejects duplicate group keys, session keys, positions, and position gaps', () => {
    expect(groupedPackageInputSchema.safeParse(payload({ groups: [group(), group()] })).success).toBe(false)
    expect(groupedPackageInputSchema.safeParse(payload({
      groups: [group({
        sessions: [session({ key: 'same' }), session({ key: 'same', position: 1 })],
      })],
    })).success).toBe(false)
    expect(groupedPackageInputSchema.safeParse(payload({
      groups: [group({
        sessions: [session(), session({ key: 'session-2', position: 0 })],
      })],
    })).success).toBe(false)
    expect(groupedPackageInputSchema.safeParse(payload({
      groups: [group({ sessions: [session({ position: 1 })] })],
    })).success).toBe(false)
  })

  it('rejects unknown dependencies and self or indirect dependency cycles', () => {
    expect(groupedPackageInputSchema.safeParse(payload({
      groups: [group({ dependsOnGroupKey: 'missing' })],
    })).success).toBe(false)
    expect(groupedPackageInputSchema.safeParse(payload({
      groups: [group({ dependsOnGroupKey: 'group-a' })],
    })).success).toBe(false)
    expect(groupedPackageInputSchema.safeParse(payload({
      groups: [
        group({ dependsOnGroupKey: 'group-b' }),
        group({ key: 'group-b', dependsOnGroupKey: 'group-a' }),
      ],
    })).success).toBe(false)
  })
})
