import { describe, expect, test } from "vitest"
import { packageSavings } from "@/components/features/packages/package-savings"

describe("packageSavings", () => {
  test("reads computed per-item discount and free-session value (Decimal strings)", () => {
    expect(packageSavings({ discountAmount: "100000", freeValue: "0" })).toEqual({ discount: 100000, freeValue: 0 })
    expect(packageSavings({ discountAmount: 70000, freeValue: 50000 })).toEqual({ discount: 70000, freeValue: 50000 })
  })

  test("treats missing or invalid values as zero", () => {
    expect(packageSavings({ discountAmount: "abc", freeValue: undefined })).toEqual({ discount: 0, freeValue: 0 })
  })
})
