import { z } from "zod"

type ScopeLike = { mode: "ANY" | "INCLUDE" | "EXCLUDE"; ids: string[] }

interface PackageItemLike {
  service: ScopeLike
  practitioner: ScopeLike
  duration: ScopeLike
  delivery: ScopeLike
  unitPriceSar?: number
  paidQuantity: number
  freeQuantity?: number
  discountType?: "PERCENTAGE" | "FIXED" | null
  discountValue?: number
}

const constrainedDimensions = [
  "service",
  "practitioner",
  "duration",
  "delivery",
] as const

export function validatePackageItem(
  item: PackageItemLike,
  ctx: z.RefinementCtx
) {
  for (const dim of constrainedDimensions) {
    const scope = item[dim]
    if (scope.mode === "ANY" && scope.ids.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [dim, "ids"],
        message: "packages.errors.scopeAnyTargets",
      })
    }
    if (scope.mode !== "ANY" && scope.ids.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [dim, "ids"],
        message: "packages.errors.scopeNeedsTarget",
      })
    }
  }

  const singleService =
    item.service.mode === "INCLUDE" && item.service.ids.length === 1
  const singlePractitioner =
    item.practitioner.mode === "INCLUDE" && item.practitioner.ids.length === 1
  const singleSpecific =
    singleService &&
    singlePractitioner &&
    item.duration.mode === "INCLUDE" &&
    item.duration.ids.length === 1

  if (
    item.duration.mode !== "ANY" &&
    (!singleService || item.duration.ids.length === 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["duration", "mode"],
      message: "packages.errors.durationNeedsService",
    })
  }

  if (!singleSpecific && !(item.unitPriceSar && item.unitPriceSar > 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["unitPriceSar"],
      message: "packages.errors.unitPriceRequired",
    })
  }

  if (
    item.discountType === "PERCENTAGE" &&
    item.discountValue != null &&
    item.discountValue > 100
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["discountValue"],
      message: "packages.errors.discountPercentageRange",
    })
  }

  // A derived single-specific price is not available in the form schema. For
  // flexible items, however, the payable amount is deterministic in SAR.
  if (
    item.discountType === "FIXED" &&
    item.discountValue != null &&
    !singleSpecific &&
    item.unitPriceSar != null &&
    item.discountValue > item.unitPriceSar * item.paidQuantity
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["discountValue"],
      message: "packages.errors.discountFixedExceedsPayable",
    })
  }
}
