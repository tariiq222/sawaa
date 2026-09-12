/**
 * Package form helpers — Sawaa Dashboard
 *
 * Pure, form-shape-aware helpers extracted from `package-form-page.tsx`:
 * default values, per-item discount conversion, and the scope→payload builder.
 */

import { sarToHalalas } from "@/lib/money"
import { isFlexibleItem, scopesToConstraints } from "@/lib/package-scope"
import type { PackageItemFormData } from "@/lib/schemas/package.schema"
import type { CreateSessionPackagePayload, PackageDiscountType } from "@/lib/types/package"

export { DEFAULT_PACKAGE_EDITOR_VALUES as DEFAULT_VALUES } from "@/lib/package-editor-defaults"

/** Per-item FIXED discount is entered in SAR; convert to halalas for storage. */
export function itemStorageDiscount(
  type: PackageDiscountType | null | undefined,
  value: number | undefined,
): number {
  if (!type || !value) return 0
  return type === "FIXED" ? sarToHalalas(value) : value
}

/**
 * Translate a form item (scopes + SAR price) into the backend item payload.
 * Always sends `constraints`; flexible items require a prepaid unit price,
 * while historical explicit prices on fixed legacy items are retained.
 */
export function buildItemPayload(
  it: PackageItemFormData,
  fallbackSort: number,
): CreateSessionPackagePayload["items"][number] {
  const singleSpecific = !isFlexibleItem(it)
  const hasHistoricalUnitPrice = it.hasUnitPriceOverride === true || (it.unitPriceSar != null && it.unitPriceSar > 0)
  return {
    // Legacy triple only when single-specific (backend derives price from it).
    serviceId: singleSpecific ? it.service.ids[0] : undefined,
    employeeId: singleSpecific ? it.practitioner.ids[0] : undefined,
    durationOptionId: singleSpecific ? it.duration.ids[0] : undefined,
    constraints: scopesToConstraints(it),
    unitPrice: hasHistoricalUnitPrice || !singleSpecific
      ? sarToHalalas(it.unitPriceSar ?? 0)
      : undefined,
    label: it.label?.trim() || undefined,
    paidQuantity: Number(it.paidQuantity ?? 0),
    freeQuantity: Number(it.freeQuantity ?? 0),
    discountType: it.discountType ?? null,
    discountValue: itemStorageDiscount(it.discountType, it.discountValue),
    sortOrder: Number(it.sortOrder ?? fallbackSort),
  }
}
