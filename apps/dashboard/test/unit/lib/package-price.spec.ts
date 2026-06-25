import { describe, expect, it } from "vitest"
import { applyPackageDiscount, computePackagePrice } from "@/lib/package-price"

// Money is integer halalas end-to-end (mirrors backend ComputePackagePriceService).
//   PERCENTAGE → discountAmount = floor(subtotal × pct / 100), capped at subtotal
//   FIXED      → discountAmount = min(discountValue, subtotal)
//   finalPrice = max(0, subtotal − discountAmount)

describe("applyPackageDiscount — FIXED (halalas)", () => {
  it("subtracts a fixed halalas discount from the halalas subtotal", () => {
    expect(applyPackageDiscount(20000, "FIXED", 5000)).toEqual({
      discountAmount: 5000,
      finalPrice: 15000,
    })
  })

  it("caps the discount at the subtotal (overshoot clamps, never negative final)", () => {
    expect(applyPackageDiscount(20000, "FIXED", 30000)).toEqual({
      discountAmount: 20000,
      finalPrice: 0,
    })
  })

  it("treats negative FIXED as 0 (Math.max guard)", () => {
    expect(applyPackageDiscount(10000, "FIXED", -1)).toEqual({
      discountAmount: 0,
      finalPrice: 10000,
    })
  })
})

describe("applyPackageDiscount — PERCENTAGE", () => {
  it("floors a 0-100 percentage against the halalas subtotal", () => {
    expect(applyPackageDiscount(20000, "PERCENTAGE", 10)).toEqual({
      discountAmount: 2000,
      finalPrice: 18000,
    })
  })

  it("caps the percentage at 100 (no over-discount)", () => {
    expect(applyPackageDiscount(20000, "PERCENTAGE", 150)).toEqual({
      discountAmount: 20000,
      finalPrice: 0,
    })
  })

  it("floors fractional halalas (9999 × 33 / 100 = 3299.67 → 3299)", () => {
    // Backend uses Math.floor for PERCENTAGE; the legacy bundle dashboard
    // used Math.round. This module intentionally matches the backend.
    expect(applyPackageDiscount(9999, "PERCENTAGE", 33)).toEqual({
      discountAmount: 3299,
      finalPrice: 6700,
    })
  })

  it("clamps negative percentage to 0", () => {
    expect(applyPackageDiscount(10000, "PERCENTAGE", -5)).toEqual({
      discountAmount: 0,
      finalPrice: 10000,
    })
  })
})

describe("computePackagePrice — item list + discount", () => {
  it("sums paidQuantity × unitPrice across rows", () => {
    expect(
      computePackagePrice(
        [
          { unitPrice: 12000, paidQuantity: 1 },
          { unitPrice: 8000, paidQuantity: 2 },
        ],
        "PERCENTAGE",
        10,
      ),
    ).toEqual({ subtotal: 28000, discountAmount: 2800, finalPrice: 25200 })
  })

  it("free-only items (paidQuantity=0) contribute 0 to the subtotal", () => {
    expect(
      computePackagePrice(
        [
          { unitPrice: 12000, paidQuantity: 1 },
          { unitPrice: 8000, paidQuantity: 0, freeQuantity: 1 },
        ],
        "FIXED",
        5000,
      ),
    ).toEqual({ subtotal: 12000, discountAmount: 5000, finalPrice: 7000 })
  })

  it("empty item list returns a zero breakdown", () => {
    expect(computePackagePrice([], "PERCENTAGE", 50)).toEqual({
      subtotal: 0,
      discountAmount: 0,
      finalPrice: 0,
    })
  })

  it("coerces string halalas (Prisma Decimal wire format) numerically", () => {
    // Backend serializes Decimal halalas as strings ("16000", "14000").
    // A bare `a + b` reduce would concatenate → 1,600,014,000 halalas.
    expect(
      computePackagePrice(
        [
          { unitPrice: "16000" as unknown as number, paidQuantity: 1 },
          { unitPrice: "14000" as unknown as number, paidQuantity: 1 },
        ],
        "PERCENTAGE",
        0,
      ),
    ).toEqual({ subtotal: 30000, discountAmount: 0, finalPrice: 30000 })
  })
})
