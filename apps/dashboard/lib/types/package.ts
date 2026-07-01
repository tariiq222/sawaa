/**
 * Session Package Types — Sawaa Dashboard
 *
 * App-local types for the SessionPackage CRUD (Phase 1 of the
 * session-packages rebuild). Mirrors the backend's `SessionPackage`,
 * `SessionPackageItem`, and `ComputePackagePriceService` outputs.
 *
 * Money is integer halalas end-to-end — the backend stores
 * `SessionPackage.discountValue` as `Decimal(12,2)` and serializes it as a
 * string over the wire, so the list/get responses carry it as `string | number`.
 * `computePackagePrice` (lib/package-price.ts) coerces with `Number()` to
 * avoid `a + b` string concatenation.
 */

import type { PaginatedQuery } from "./common"

/* ─── Discount type ─── */

export type PackageDiscountType = "PERCENTAGE" | "FIXED"

/* ─── Constraint dimensions / modes ─── */

/**
 * A package item's eligibility is expressed per dimension:
 *   SERVICE → service ids · PRACTITIONER → employee ids ·
 *   DURATION → durationOption id · DELIVERY_TYPE → 'IN_PERSON' | 'ONLINE'.
 */
export type PackageConstraintDimension =
  | "SERVICE"
  | "PRACTITIONER"
  | "DURATION"
  | "DELIVERY_TYPE"

/** ANY = no targets (matches all) · INCLUDE/EXCLUDE = ≥1 target. */
export type PackageConstraintMode = "ANY" | "INCLUDE" | "EXCLUDE"

/** Write-side constraint (what we send on create/update). */
export interface PackageConstraintInput {
  dimension: PackageConstraintDimension
  mode: PackageConstraintMode
  /** Omitted/empty for ANY; ≥1 id for INCLUDE/EXCLUDE. */
  targetIds?: string[]
}

/** Read-side constraint (what GET returns — targets nested as rows). */
export interface PackageConstraintResponse {
  dimension: PackageConstraintDimension
  mode: PackageConstraintMode
  targets: { targetId: string }[]
}

/* ─── Entities ─── */

/**
 * A package item is EITHER single-specific (legacy triple present) OR flexible
 * (rule-based via `constraints`). The legacy triple is now nullable; when an
 * item is flexible it carries a fixed prepaid `unitPrice` (halalas) instead of
 * a price derived from one service/practitioner/duration.
 *
 * `constraints` is optional on read: older packages (and any endpoint that does
 * not eager-load them) omit it — the form falls back to the legacy triple.
 */
export interface SessionPackageItem {
  id: string
  packageId: string
  serviceId: string | null
  employeeId: string | null
  durationOptionId: string | null
  /** Fixed prepaid unit price (integer halalas) for flexible items. null = derive. */
  unitPrice: number | string | null
  /** Optional display label. */
  label?: string | null
  paidQuantity: number
  freeQuantity: number
  /** Per-item discount applied to (paid × unit). null = no discount. */
  discountType: PackageDiscountType | null
  discountValue: number | string
  sortOrder: number
  /** Multi-dimensional eligibility. Absent on older data → use the legacy triple. */
  constraints?: PackageConstraintResponse[]
}

/**
 * List response — one row per package. `items` is the count of package
 * items attached to the package (see `SessionPackageItem`).
 * `subtotal` / `discountAmount` / `finalPrice` come from
 * `ComputePackagePriceService.compute` (the backend runs it server-side on
 * every list/get so the catalog never displays stale math).
 *
 * `discountValue` and the three money fields arrive as either `number` or
 * `string` from the Prisma Decimal wire format — coerce with `Number()`.
 */
export interface SessionPackage {
  id: string
  nameAr: string
  nameEn: string | null
  descriptionAr: string | null
  descriptionEn: string | null
  imageUrl: string | null
  iconName: string | null
  iconBgColor: string | null
  /** DEPRECATED package-level discount — superseded by per-item discount. */
  discountType: PackageDiscountType
  discountValue: number | string
  isActive: boolean
  isPublic: boolean
  sortOrder: number
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  items: SessionPackageItem[]
  subtotal: number | string
  discountAmount: number | string
  finalPrice: number | string
  /** Total true value incl. free sessions, and the value given for free (display). */
  fullValue?: number | string
  freeValue?: number | string
}

/* ─── Item payloads (write side) ─── */

export interface CreatePackageItemPayload {
  /** Legacy single-service UUID. Omit for flexible items (use constraints). */
  serviceId?: string
  /** Legacy single-practitioner UUID. Omit for flexible items (use constraints). */
  employeeId?: string
  /** Legacy single ServiceDurationOption UUID. Omit for flexible items (use constraints). */
  durationOptionId?: string
  /** Multi-dimensional eligibility. Preferred over the legacy triple — always sent. */
  constraints?: PackageConstraintInput[]
  /** Fixed prepaid unit price (integer halalas). Required for flexible items. */
  unitPrice?: number
  /** Optional display label. */
  label?: string
  paidQuantity: number
  freeQuantity?: number
  /** Per-item discount. PERCENTAGE: 0-100. FIXED: integer halalas. null/omit = none. */
  discountType?: PackageDiscountType | null
  discountValue?: number
  sortOrder?: number
}

export type UpdatePackageItemPayload = CreatePackageItemPayload

/* ─── Package payloads (write side) ─── */

export interface CreateSessionPackagePayload {
  nameAr: string
  nameEn?: string
  descriptionAr?: string
  descriptionEn?: string
  imageUrl?: string | null
  iconName?: string | null
  iconBgColor?: string | null
  /** DEPRECATED — discount now lives per-item. Backend ignores these. */
  discountType?: PackageDiscountType
  discountValue?: number
  isActive?: boolean
  isPublic?: boolean
  sortOrder?: number
  items: CreatePackageItemPayload[]
}

export type UpdateSessionPackagePayload = Partial<Omit<CreateSessionPackagePayload, "items">> & {
  items?: CreatePackageItemPayload[]
}

/* ─── Queries ─── */

export interface PackageListQuery extends PaginatedQuery {
  search?: string
  isActive?: boolean
  isPublic?: boolean
}

/* ─── Price breakdown (for the form preview only — list/get already include it) ─── */

/** Per-line price detail (integer halalas) — mirrors the backend `lines[]`. */
export interface PackageLineBreakdown {
  fullValue: number // (paid + free) × unit
  freeValue: number // free × unit
  payable: number // paid × unit
  discountAmount: number // item discount on payable
  net: number // payable − discount
}

export interface PackagePriceBreakdown {
  subtotal: number // Σ payable (paid × unit)
  discountAmount: number // Σ per-item discount
  finalPrice: number // subtotal − discountAmount
  fullValue: number // Σ fullValue (incl. free sessions)
  freeValue: number // Σ freeValue
  totalSavings: number // freeValue + discountAmount
  lines: PackageLineBreakdown[]
}
