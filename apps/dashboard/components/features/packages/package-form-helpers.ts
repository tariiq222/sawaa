/**
 * Package form helpers — Sawaa Dashboard
 *
 * Pure, form-shape-aware helpers extracted from `package-form-page.tsx`:
 * default values, per-item discount conversion, and the scope→payload builder.
 */

import { sarToHalalas } from "@/lib/money"
import { isSingleSpecificItem, scopesToConstraints } from "@/lib/package-scope"
import type { PackageFormData, PackageItemFormData } from "@/lib/schemas/package.schema"
import type { CreateSessionPackagePayload, PackageDiscountType } from "@/lib/types/package"

export const DEFAULT_VALUES: PackageFormData = {
  nameAr: "",
  nameEn: "",
  descriptionAr: "",
  descriptionEn: "",
  imageUrl: null,
  iconName: null,
  iconBgColor: null,
  sortOrder: 0,
  isActive: true,
  isPublic: false,
  items: [],
}

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
 * Always sends `constraints`; sends `unitPrice` (halalas) only for flexible
 * (non single-specific) items — single-specific items keep the derived price.
 */
export function buildItemPayload(
  it: PackageItemFormData,
  fallbackSort: number,
): CreateSessionPackagePayload["items"][number] {
  const singleSpecific = isSingleSpecificItem(it)
  return {
    // Legacy triple only when single-specific (backend derives price from it).
    serviceId: singleSpecific ? it.service.ids[0] : undefined,
    employeeId: singleSpecific ? it.practitioner.ids[0] : undefined,
    durationOptionId: singleSpecific ? it.duration.ids[0] : undefined,
    constraints: scopesToConstraints(it),
    unitPrice: singleSpecific ? undefined : sarToHalalas(it.unitPriceSar ?? 0),
    label: it.label?.trim() || undefined,
    paidQuantity: Number(it.paidQuantity ?? 0),
    freeQuantity: Number(it.freeQuantity ?? 0),
    discountType: it.discountType ?? null,
    discountValue: itemStorageDiscount(it.discountType, it.discountValue),
    sortOrder: Number(it.sortOrder ?? fallbackSort),
  }
}
