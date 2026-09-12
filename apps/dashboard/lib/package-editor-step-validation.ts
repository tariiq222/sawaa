import { createPackageSchema, packageItemSchema } from "./schemas/package.schema"
import type { PackageFormData, PackageItemFormData, ScopeFormData } from "./schemas/package.schema"

export type PackageStep = 1 | 2 | 3 | 4

export interface PackageStepIssue {
  path: (string | number)[]
  message: string
}

export interface PackageStepResult {
  success: boolean
  issues: PackageStepIssue[]
}

const stepScopes = ["service", "practitioner", "duration", "delivery"] as const

function scopeIssues(item: PackageItemFormData, index: number, ownerEmployeeId?: string | null): PackageStepIssue[] {
  const issues: PackageStepIssue[] = []
  for (const dimension of stepScopes) {
    const scope = item[dimension]
    if (scope.mode === "ANY" && scope.ids.length > 0) {
      issues.push({ path: ["items", index, dimension, "ids"], message: "packages.errors.scopeAnyTargets" })
    }
    if (scope.mode !== "ANY" && scope.ids.length === 0) {
      issues.push({ path: ["items", index, dimension, "ids"], message: "packages.errors.scopeNeedsTarget" })
    }
  }
  const fixed = item.selectionMode === "FIXED"
  const single = (scope: ScopeFormData) => scope.mode === "INCLUDE" && scope.ids.length === 1
  if (fixed && (!single(item.service) || (!ownerEmployeeId && !single(item.practitioner)) || !single(item.duration))) {
    for (const dimension of ["service", "practitioner", "duration"] as const) {
      if (ownerEmployeeId && dimension === "practitioner") continue
      if (!single(item[dimension])) issues.push({ path: ["items", index, dimension, "ids"], message: "packages.errors.fixedNeedsSelection" })
    }
  }
  if (item.duration.mode !== "ANY" && (!single(item.service) || item.duration.ids.length === 0)) {
    issues.push({ path: ["items", index, "duration", "mode"], message: "packages.errors.durationNeedsService" })
  }
  return issues
}

/** Validate only the fields needed to leave an editor step. */
export function validatePackageStep(data: PackageFormData, step: PackageStep): PackageStepResult {
  const issues: PackageStepIssue[] = []
  if (step === 1 && !data.nameAr?.trim()) issues.push({ path: ["nameAr"], message: "common.required" })
  if (step >= 2) {
    const items = data.items ?? []
    if (items.length === 0) issues.push({ path: ["items"], message: "packages.errors.minItems" })
    items.forEach((item, index) => issues.push(...scopeIssues(item, index, data.ownerEmployeeId)))
  }
  if (step >= 3) {
    ;(data.items ?? []).forEach((item, index) => {
      if (item.priceUnavailable) issues.push({ path: ["items", index, "unitPriceSar"], message: "packages.errors.priceUnavailable" })
      const parsed = packageItemSchema.safeParse(item)
      if (!parsed.success) issues.push(...parsed.error.issues.map((issue) => ({ path: ["items", index, ...issue.path], message: issue.message })))
    })
  }
  if (step === 4) {
    const parsed = createPackageSchema.safeParse(data)
    if (!parsed.success) issues.push(...parsed.error.issues.map((issue) => ({ path: issue.path, message: issue.message })))
  }
  return { success: issues.length === 0, issues }
}
