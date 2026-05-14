import { describe, expect, it } from "vitest"
import { cn } from "@/lib/utils"
import { halalasToSar, sarToHalalas, formatPrice } from "@/lib/money"

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar")
  })

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible")
  })

  it("deduplicates conflicting Tailwind classes (last wins)", () => {
    const result = cn("p-4", "p-8")
    expect(result).toBe("p-8")
  })

  it("handles undefined and null values", () => {
    expect(cn("base", undefined, null, "end")).toBe("base end")
  })
})

describe("halalasToSar", () => {
  it("converts halalas to SAR", () => {
    expect(halalasToSar(10000)).toBe(100)
  })

  it("returns 0 for null/undefined", () => {
    expect(halalasToSar(null)).toBe(0)
    expect(halalasToSar(undefined)).toBe(0)
  })
})

describe("sarToHalalas", () => {
  it("converts SAR to halalas", () => {
    expect(sarToHalalas(100)).toBe(10000)
  })

  it("rounds to nearest halala", () => {
    expect(sarToHalalas(10.505)).toBe(1051)
  })
})

describe("formatPrice", () => {
  it("returns dash for null", () => {
    expect(formatPrice(null)).toBe("—")
  })

  it("returns dash for undefined", () => {
    expect(formatPrice(undefined)).toBe("—")
  })

  it("converts halalas to SAR numeric value", () => {
    expect(halalasToSar(10000)).toBe(100)
  })
})
