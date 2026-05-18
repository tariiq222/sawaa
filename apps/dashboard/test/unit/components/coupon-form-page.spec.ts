import { describe, expect, it } from "vitest"
import { toDisplayMinOrderAmt, toStorageMinOrderAmt } from "@/components/features/coupons/coupon-form-page"

describe("coupon-form-page minOrderAmt conversions", () => {
  describe("toDisplayMinOrderAmt (halalas → SAR)", () => {
    it("converts 5000 halalas to 50 SAR for edit mode display", () => {
      expect(toDisplayMinOrderAmt(5000)).toBe(50)
    })

    it("converts 10000 halalas to 100 SAR", () => {
      expect(toDisplayMinOrderAmt(10000)).toBe(100)
    })

    it("returns empty string for null", () => {
      expect(toDisplayMinOrderAmt(null)).toBe("")
    })

    it("returns empty string for undefined", () => {
      expect(toDisplayMinOrderAmt(undefined)).toBe("")
    })

    it("handles zero halalas", () => {
      expect(toDisplayMinOrderAmt(0)).toBe(0)
    })
  })

  describe("toStorageMinOrderAmt (SAR → halalas)", () => {
    it("converts 50 SAR to 5000 halalas on submit", () => {
      expect(toStorageMinOrderAmt(50)).toBe(5000)
    })

    it("converts 100 SAR to 10000 halalas", () => {
      expect(toStorageMinOrderAmt(100)).toBe(10000)
    })

    it("returns undefined for empty string", () => {
      expect(toStorageMinOrderAmt("")).toBeUndefined()
    })

    it("returns undefined for undefined", () => {
      expect(toStorageMinOrderAmt(undefined)).toBeUndefined()
    })

    it("handles fractional SAR", () => {
      expect(toStorageMinOrderAmt(49.5)).toBe(4950)
    })

    it("handles zero SAR", () => {
      expect(toStorageMinOrderAmt(0)).toBe(0)
    })
  })
})
