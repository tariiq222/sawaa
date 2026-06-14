import { describe, expect, it } from "vitest"
import { computeBundlePrice } from "@/lib/bundle-price"

// computeBundlePrice operates entirely in integer halalas.
// For FIXED, discountValue is halalas; for PERCENTAGE it is a 0-100 percent.

describe("computeBundlePrice — FIXED (halalas)", () => {
  it("subtracts a fixed halalas discount from the halalas subtotal", () => {
    expect(computeBundlePrice([12000, 8000], "FIXED", 5000)).toEqual({
      subtotal: 20000,
      discountAmount: 5000,
      finalPrice: 15000,
    })
  })

  it("caps the discount at the subtotal", () => {
    expect(computeBundlePrice([12000, 8000], "FIXED", 30000)).toEqual({
      subtotal: 20000,
      discountAmount: 20000,
      finalPrice: 0,
    })
  })
})

describe("computeBundlePrice — PERCENTAGE", () => {
  it("applies a 0-100 percent discount to the halalas subtotal", () => {
    expect(computeBundlePrice([12000, 8000], "PERCENTAGE", 10)).toEqual({
      subtotal: 20000,
      discountAmount: 2000,
      finalPrice: 18000,
    })
  })

  it("caps the percentage at 100", () => {
    expect(computeBundlePrice([12000, 8000], "PERCENTAGE", 150)).toEqual({
      subtotal: 20000,
      discountAmount: 20000,
      finalPrice: 0,
    })
  })

  it("rounds the discount to whole halalas", () => {
    // 9999 * 33 / 100 = 3299.67 -> 3300
    expect(computeBundlePrice([9999], "PERCENTAGE", 33)).toEqual({
      subtotal: 9999,
      discountAmount: 3300,
      finalPrice: 6699,
    })
  })
})

describe("computeBundlePrice — string halalas (Prisma Decimal regression)", () => {
  it("sums string prices numerically instead of concatenating them", () => {
    // The backend serializes Decimal halalas as strings ("16000", "14000").
    // A bare `a + b` reduce would concatenate -> 1,600,014,000 halalas.
    expect(
      computeBundlePrice(["16000", "14000"] as unknown as number[], "PERCENTAGE", 0),
    ).toEqual({
      subtotal: 30000,
      discountAmount: 0,
      finalPrice: 30000,
    })
  })
})
