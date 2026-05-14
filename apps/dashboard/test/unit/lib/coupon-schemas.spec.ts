import { describe, expect, it } from "vitest"
import { couponSchema } from "@/lib/schemas/coupon.schema"

const validCoupon = {
  code: "SAVE20",
  discountType: "PERCENTAGE" as const,
  discountValue: 20,
  isActive: true,
}

describe("couponSchema", () => {
  it("accepts a valid coupon", () => {
    const result = couponSchema.safeParse(validCoupon)
    expect(result.success).toBe(true)
  })

  it("rejects code shorter than 3 chars", () => {
    const result = couponSchema.safeParse({ ...validCoupon, code: "AB" })
    expect(result.success).toBe(false)
  })

  it("rejects code longer than 20 chars", () => {
    const result = couponSchema.safeParse({ ...validCoupon, code: "A".repeat(21) })
    expect(result.success).toBe(false)
  })

  it("rejects code with invalid characters", () => {
    const result = couponSchema.safeParse({ ...validCoupon, code: "SAVE 20" })
    expect(result.success).toBe(false)
  })

  it("accepts fixed discount type", () => {
    const result = couponSchema.safeParse({ ...validCoupon, discountType: "FIXED" })
    expect(result.success).toBe(true)
  })

  it("rejects unknown discount type", () => {
    const result = couponSchema.safeParse({ ...validCoupon, discountType: "half" })
    expect(result.success).toBe(false)
  })

  it("rejects discountValue of 0", () => {
    const result = couponSchema.safeParse({ ...validCoupon, discountValue: 0 })
    expect(result.success).toBe(false)
  })

  it("accepts serviceIds array", () => {
    const result = couponSchema.safeParse({ ...validCoupon, serviceIds: ["svc-1", "svc-2"] })
    expect(result.success).toBe(true)
  })
})
