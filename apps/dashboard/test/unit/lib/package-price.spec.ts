import { describe, expect, it } from "vitest"
import { applyItemDiscount, computePackagePrice } from "@/lib/package-price"

// Money is integer halalas end-to-end (mirrors backend ComputePackagePriceService).
// Discount is now PER ITEM, applied to the item's payable (paid × unitPrice):
//   PERCENTAGE → floor(base × pct / 100), pct clamped to 0-100
//   FIXED      → min(value, base)
//   null type / 0 value → no discount

describe("applyItemDiscount", () => {
  it("subtracts a fixed halalas discount from the base", () => {
    expect(applyItemDiscount(20000, "FIXED", 5000)).toBe(5000)
  })

  it("caps a FIXED discount at the base (never negative)", () => {
    expect(applyItemDiscount(20000, "FIXED", 30000)).toBe(20000)
  })

  it("floors a 0-100 percentage against the base", () => {
    expect(applyItemDiscount(20000, "PERCENTAGE", 10)).toBe(2000)
  })

  it("caps the percentage at 100", () => {
    expect(applyItemDiscount(20000, "PERCENTAGE", 150)).toBe(20000)
  })

  it("floors fractional halalas (9999 × 33 / 100 = 3299.67 → 3299)", () => {
    expect(applyItemDiscount(9999, "PERCENTAGE", 33)).toBe(3299)
  })

  it("returns 0 for a null type", () => {
    expect(applyItemDiscount(10000, null, 50)).toBe(0)
  })

  it("returns 0 for a zero value", () => {
    expect(applyItemDiscount(10000, "PERCENTAGE", 0)).toBe(0)
  })
})

describe("computePackagePrice — per-item breakdown", () => {
  it("sums payable across rows and applies per-item discounts", () => {
    const r = computePackagePrice([
      { unitPrice: 12000, paidQuantity: 1, discountType: "PERCENTAGE", discountValue: 10 }, // 12000, −1200
      { unitPrice: 8000, paidQuantity: 2 }, // 16000, no discount
    ])
    expect(r.subtotal).toBe(28000)
    expect(r.discountAmount).toBe(1200)
    expect(r.finalPrice).toBe(26800)
    expect(r.lines[0].net).toBe(10800)
    expect(r.lines[1].net).toBe(16000)
  })

  it("free sessions add to fullValue/freeValue but never to subtotal", () => {
    const r = computePackagePrice([{ unitPrice: 10000, paidQuantity: 4, freeQuantity: 1 }])
    expect(r.subtotal).toBe(40000)
    expect(r.fullValue).toBe(50000)
    expect(r.freeValue).toBe(10000)
    expect(r.finalPrice).toBe(40000)
    expect(r.totalSavings).toBe(10000) // free value + 0 discount
  })

  it("totalSavings sums free value and item discounts", () => {
    const r = computePackagePrice([
      { unitPrice: 10000, paidQuantity: 2, freeQuantity: 1, discountType: "FIXED", discountValue: 3000 },
    ])
    // payable 20000, free value 10000, discount 3000
    expect(r.subtotal).toBe(20000)
    expect(r.discountAmount).toBe(3000)
    expect(r.freeValue).toBe(10000)
    expect(r.finalPrice).toBe(17000)
    expect(r.totalSavings).toBe(13000)
  })

  it("free-only items (paidQuantity=0) contribute 0 to subtotal", () => {
    const r = computePackagePrice([
      { unitPrice: 12000, paidQuantity: 1 },
      { unitPrice: 8000, paidQuantity: 0, freeQuantity: 1 },
    ])
    expect(r.subtotal).toBe(12000)
    expect(r.freeValue).toBe(8000)
    expect(r.finalPrice).toBe(12000)
  })

  it("empty item list returns a zero breakdown", () => {
    const r = computePackagePrice([])
    expect(r).toMatchObject({ subtotal: 0, discountAmount: 0, finalPrice: 0, fullValue: 0, freeValue: 0 })
  })

  it("coerces string halalas (Prisma Decimal wire format) numerically", () => {
    const r = computePackagePrice([
      { unitPrice: "16000" as unknown as number, paidQuantity: 1 },
      { unitPrice: "14000" as unknown as number, paidQuantity: 1 },
    ])
    expect(r.subtotal).toBe(30000)
    expect(r.finalPrice).toBe(30000)
  })
})
