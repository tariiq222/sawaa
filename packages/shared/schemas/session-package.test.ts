import { describe, it, expect } from 'vitest'
import {
  discountTypeSchema,
  packagePurchaseStatusSchema,
  packageCreditUsageStatusSchema,
  packagePriceBreakdownSchema,
  sessionPackageItemInputSchema,
  createSessionPackageSchema,
  updateSessionPackageSchema,
} from './session-package'

function uuid4(): string {
  // Deterministic v4-ish UUIDs for fixtures — first 13 hex chars are zeroed
  // to avoid collision with other suites' random IDs.
  const hex = '0123456789abcdef'
  let s = '00000000-0000-4000-8000-000000000000'
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '0') s = s.slice(0, i) + hex[(i * 7) % 16] + s.slice(i + 1)
  }
  return s
}

function validItem() {
  return {
    serviceId: uuid4(),
    employeeId: uuid4(),
    durationOptionId: uuid4(),
    paidQuantity: 4,
  }
}

function validCreate() {
  return {
    nameAr: 'باقة العائلة',
    discountType: 'PERCENTAGE' as const,
    discountValue: 10,
    items: [validItem()],
  }
}

describe('discountTypeSchema', () => {
  it.each(['PERCENTAGE', 'FIXED'] as const)('accepts "%s"', (value) => {
    expect(discountTypeSchema.safeParse(value).success).toBe(true)
  })

  it('rejects an unknown discount type', () => {
    expect(discountTypeSchema.safeParse('FLAT').success).toBe(false)
  })

  it('rejects a lowercase discount type (case-sensitive)', () => {
    expect(discountTypeSchema.safeParse('percentage').success).toBe(false)
  })
})

describe('packagePurchaseStatusSchema', () => {
  it.each(['ACTIVE', 'COMPLETED', 'REFUNDED'] as const)('accepts "%s"', (value) => {
    expect(packagePurchaseStatusSchema.safeParse(value).success).toBe(true)
  })

  it('rejects an unknown status', () => {
    expect(packagePurchaseStatusSchema.safeParse('CANCELLED').success).toBe(false)
  })
})

describe('packageCreditUsageStatusSchema', () => {
  it.each(['CONSUMED', 'RETURNED'] as const)('accepts "%s"', (value) => {
    expect(packageCreditUsageStatusSchema.safeParse(value).success).toBe(true)
  })

  it('rejects an unknown status', () => {
    expect(packageCreditUsageStatusSchema.safeParse('REVERSED').success).toBe(false)
  })
})

describe('packagePriceBreakdownSchema', () => {
  it('accepts a valid breakdown with at least one item', () => {
    const r = packagePriceBreakdownSchema.safeParse({
      subtotal: 50000,
      discountAmount: 5000,
      finalPrice: 45000,
      itemUnitPrices: [{ durationOptionId: uuid4(), unitPrice: 12500 }],
    })
    expect(r.success).toBe(true)
  })

  it('accepts an empty itemUnitPrices array', () => {
    const r = packagePriceBreakdownSchema.safeParse({
      subtotal: 0,
      discountAmount: 0,
      finalPrice: 0,
      itemUnitPrices: [],
    })
    expect(r.success).toBe(true)
  })

  it('rejects a negative subtotal', () => {
    const r = packagePriceBreakdownSchema.safeParse({
      subtotal: -1,
      discountAmount: 0,
      finalPrice: 0,
      itemUnitPrices: [],
    })
    expect(r.success).toBe(false)
  })

  it('rejects a non-integer subtotal (halalas must be integer)', () => {
    const r = packagePriceBreakdownSchema.safeParse({
      subtotal: 99.5,
      discountAmount: 0,
      finalPrice: 0,
      itemUnitPrices: [],
    })
    expect(r.success).toBe(false)
  })

  it('rejects a non-uuid durationOptionId inside itemUnitPrices', () => {
    const r = packagePriceBreakdownSchema.safeParse({
      subtotal: 0,
      discountAmount: 0,
      finalPrice: 0,
      itemUnitPrices: [{ durationOptionId: 'not-a-uuid', unitPrice: 0 }],
    })
    expect(r.success).toBe(false)
  })
})

describe('sessionPackageItemInputSchema', () => {
  it('accepts a minimal item (paidQuantity only)', () => {
    const r = sessionPackageItemInputSchema.safeParse(validItem())
    expect(r.success).toBe(true)
  })

  it('accepts an item with free bonus sessions only (paid=0, free>=1)', () => {
    const r = sessionPackageItemInputSchema.safeParse({
      ...validItem(),
      paidQuantity: 0,
      freeQuantity: 2,
    })
    expect(r.success).toBe(true)
  })

  it('rejects a non-uuid serviceId', () => {
    const r = sessionPackageItemInputSchema.safeParse({ ...validItem(), serviceId: 'svc-1' })
    expect(r.success).toBe(false)
  })

  it('rejects a negative paidQuantity', () => {
    const r = sessionPackageItemInputSchema.safeParse({ ...validItem(), paidQuantity: -1 })
    expect(r.success).toBe(false)
  })

  it('rejects a non-integer paidQuantity', () => {
    const r = sessionPackageItemInputSchema.safeParse({ ...validItem(), paidQuantity: 1.5 })
    expect(r.success).toBe(false)
  })

  it('rejects a negative freeQuantity', () => {
    const r = sessionPackageItemInputSchema.safeParse({ ...validItem(), freeQuantity: -1 })
    expect(r.success).toBe(false)
  })
})

describe('createSessionPackageSchema', () => {
  it('accepts a minimal valid create payload', () => {
    const r = createSessionPackageSchema.safeParse(validCreate())
    expect(r.success).toBe(true)
  })

  it('accepts a fully populated create payload with FIXED discount in halalas', () => {
    const r = createSessionPackageSchema.safeParse({
      ...validCreate(),
      nameEn: 'Family Pack',
      descriptionAr: 'أربع جلسات استشارة',
      descriptionEn: 'Four consultation sessions',
      imageUrl: 'https://cdn.example.com/pack.png',
      iconName: 'package',
      iconBgColor: '#FFD8A8',
      discountType: 'FIXED',
      discountValue: 5000,
      isActive: true,
      isPublic: true,
      sortOrder: 3,
      items: [
        { ...validItem(), paidQuantity: 4, freeQuantity: 1, sortOrder: 0 },
        { ...validItem(), paidQuantity: 0, freeQuantity: 1, sortOrder: 1 },
      ],
    })
    expect(r.success).toBe(true)
  })

  it('rejects a missing nameAr', () => {
    const { nameAr, ...rest } = validCreate()
    const r = createSessionPackageSchema.safeParse(rest)
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error.issues[0].path).toContain('nameAr')
  })

  it('rejects an empty nameAr', () => {
    const r = createSessionPackageSchema.safeParse({ ...validCreate(), nameAr: '' })
    expect(r.success).toBe(false)
  })

  it('rejects a nameAr longer than 200 characters', () => {
    const r = createSessionPackageSchema.safeParse({ ...validCreate(), nameAr: 'x'.repeat(201) })
    expect(r.success).toBe(false)
  })

  it('rejects a missing discountType', () => {
    const { discountType, ...rest } = validCreate()
    const r = createSessionPackageSchema.safeParse(rest)
    expect(r.success).toBe(false)
  })

  it('rejects a missing discountValue', () => {
    const { discountValue, ...rest } = validCreate()
    const r = createSessionPackageSchema.safeParse(rest)
    expect(r.success).toBe(false)
  })

  it('rejects a negative discountValue', () => {
    const r = createSessionPackageSchema.safeParse({ ...validCreate(), discountValue: -1 })
    expect(r.success).toBe(false)
  })

  it('rejects an empty items array', () => {
    const r = createSessionPackageSchema.safeParse({ ...validCreate(), items: [] })
    expect(r.success).toBe(false)
  })

  it('rejects a missing items array', () => {
    const { items, ...rest } = validCreate()
    const r = createSessionPackageSchema.safeParse(rest)
    expect(r.success).toBe(false)
  })

  it('rejects an item with paidQuantity=0 and freeQuantity=0', () => {
    const r = createSessionPackageSchema.safeParse({
      ...validCreate(),
      items: [{ ...validItem(), paidQuantity: 0, freeQuantity: 0 }],
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      // The superRefine attaches the issue at items[N] with the cross-field message.
      const message = r.error.issues.map((i) => i.message).join(' | ')
      expect(message).toMatch(/at least one session/)
    }
  })
})

describe('updateSessionPackageSchema', () => {
  it('accepts an empty payload (all fields optional)', () => {
    const r = updateSessionPackageSchema.safeParse({})
    expect(r.success).toBe(true)
  })

  it('accepts a single-field patch (nameAr only)', () => {
    const r = updateSessionPackageSchema.safeParse({ nameAr: 'باقة محدّثة' })
    expect(r.success).toBe(true)
  })

  it('accepts a discount-only patch', () => {
    const r = updateSessionPackageSchema.safeParse({
      discountType: 'FIXED',
      discountValue: 7500,
    })
    expect(r.success).toBe(true)
  })

  it('accepts an items replacement array', () => {
    const r = updateSessionPackageSchema.safeParse({ items: [validItem()] })
    expect(r.success).toBe(true)
  })

  it('rejects an empty items replacement array (handler requires min 1)', () => {
    const r = updateSessionPackageSchema.safeParse({ items: [] })
    expect(r.success).toBe(false)
  })

  it('rejects an item with paidQuantity=0 and freeQuantity=0 in the replacement', () => {
    const r = updateSessionPackageSchema.safeParse({
      items: [{ ...validItem(), paidQuantity: 0, freeQuantity: 0 }],
    })
    expect(r.success).toBe(false)
  })

  it('rejects a nameAr longer than 200 characters when provided', () => {
    const r = updateSessionPackageSchema.safeParse({ nameAr: 'x'.repeat(201) })
    expect(r.success).toBe(false)
  })

  it('still validates discountValue range when provided', () => {
    const r = updateSessionPackageSchema.safeParse({ discountValue: -1 })
    expect(r.success).toBe(false)
  })
})
