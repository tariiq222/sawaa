import { describe, expect, it } from "vitest"
import { formatPrice, halalasToSar, sarToHalalas } from "@/lib/money"

describe("money helpers", () => {
  describe("halalasToSar", () => {
    it("converts halalas to SAR", () => {
      expect(halalasToSar(15000)).toBe(150)
      expect(halalasToSar(99)).toBe(0.99)
      expect(halalasToSar(0)).toBe(0)
    })

    it("returns 0 for null/undefined/NaN", () => {
      expect(halalasToSar(null)).toBe(0)
      expect(halalasToSar(undefined)).toBe(0)
      expect(halalasToSar(Number.NaN)).toBe(0)
    })
  })

  describe("sarToHalalas", () => {
    it("converts SAR to halalas (integer)", () => {
      expect(sarToHalalas(150)).toBe(15000)
      expect(sarToHalalas(0.99)).toBe(99)
      expect(sarToHalalas(1.5)).toBe(150) // exact
    })

    it("returns 0 for null/undefined", () => {
      expect(sarToHalalas(null)).toBe(0)
      expect(sarToHalalas(undefined)).toBe(0)
    })
  })

  describe("formatPrice", () => {
    it("formats halalas as SAR string with default 2 decimals", () => {
      expect(formatPrice(15000)).toBe("150.00")
      expect(formatPrice(99)).toBe("0.99")
    })

    it("respects decimals option", () => {
      expect(formatPrice(15000, { decimals: 0 })).toBe("150")
      expect(formatPrice(15050, { decimals: 0 })).toBe("151")
    })

    it("returns em-dash for null/undefined", () => {
      expect(formatPrice(null)).toBe("—")
      expect(formatPrice(undefined)).toBe("—")
    })

    it("uses latn digits for both locales", () => {
      // Both should produce ASCII digits (we force -u-nu-latn for AR)
      expect(formatPrice(15000, { locale: "ar" })).toMatch(/^[\d.,]+$/)
      expect(formatPrice(15000, { locale: "en" })).toMatch(/^[\d.,]+$/)
    })
  })
})
