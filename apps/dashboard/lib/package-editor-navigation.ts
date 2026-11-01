import type { PackageStep } from "./package-editor-step-validation"

/** Map a field or API validation path to the editor step that can fix it. */
export function packageStepForPath(path: string): PackageStep {
  if (/^(nameAr|nameEn|description|image|icon|sortOrder|isActive|isPublic|ownerEmployeeId)/.test(path)) return 1
  if (/^items(?:\.\d+)?\.(service|practitioner|duration|delivery|selectionMode|originalConstraints)/.test(path)) return 2
  if (/^items(?:\.\d+)?\.(paidQuantity|freeQuantity|unitPriceSar|discount|label|sortOrder)/.test(path)) return 3
  if (path === "items" || path.startsWith("items.")) return 2
  return 1
}

export function firstPackageStep(paths: string[]): PackageStep {
  return paths.reduce<PackageStep>((step, path) => Math.min(step, packageStepForPath(path)) as PackageStep, 4)
}

/**
 * The real dashboard route for editing a created package (t15).
 * Matches `app/(dashboard)/packages/[id]/edit/page.tsx`, which renders the
 * editor for both LEGACY and GROUPED_V2 packages and picks the model itself.
 */
export function packageEditPath(packageId: string): string {
  return `/packages/${encodeURIComponent(packageId)}/edit`
}
