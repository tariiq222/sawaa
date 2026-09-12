import { describe, expect, it } from "vitest"
import { validatePackageStep } from "@/lib/package-editor-step-validation"
import type { PackageFormData } from "@/lib/schemas/package.schema"

const item = {
  selectionMode: "FLEXIBLE" as const,
  service: { mode: "INCLUDE" as const, ids: ["service-id"] },
  practitioner: { mode: "ANY" as const, ids: [] },
  duration: { mode: "ANY" as const, ids: [] },
  delivery: { mode: "ANY" as const, ids: [] },
  unitPriceSar: 100,
  paidQuantity: 0,
  freeQuantity: 0,
}

describe("validatePackageStep quantity checks", () => {
  it("reports minQuantity at the paid quantity path on step 3", () => {
    const result = validatePackageStep(
      { nameAr: "باقة", items: [item] } satisfies PackageFormData,
      3
    )

    expect(result.issues).toContainEqual({
      path: ["items", 0, "paidQuantity"],
      message: "packages.errors.minQuantity",
    })
  })
})
