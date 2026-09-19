/**
 * Session-package domain (credit packs).
 *
 * A SessionPackage is a *definition* — the catalog entry. The actual money
 * and unit prices are computed on demand for the GET/list response and
 * frozen as snapshots on the matching PackagePurchase at buy time. See
 * [apps/backend/src/modules/org-experience/compute-package-price.service.ts]
 * and [docs/plans/session-packages-rebuild.md].
 *
 * All monetary fields are integer halalas (1 SAR = 100 halalas). The
 * `discountValue` field is the one exception to the "integer halalas" rule:
 *   - discountType === 'FIXED'      → integer halalas
 *   - discountType === 'PERCENTAGE' → a 0..100 percentage (e.g. 10 = 10%)
 *
 * For purchase / credit / usage tables the related `packageId` / `clientId`
 * / `branchId` / `serviceId` / `employeeId` / `durationOptionId` / `bookingId`
 * are plain cross-BC string IDs (no Prisma FK), matching the backend schema.
 */

import type { GlobalDiscount, GroupSequenceMode, PackageGroupInput, PackageModelVersion } from './session-package-v2'

/** Discount shape on a package. Mirrors the Prisma enum `DiscountType`. */
export type DiscountType = 'PERCENTAGE' | 'FIXED'

/** Purchase lifecycle status (Prisma enum `PackagePurchaseStatus`). */
export type PackagePurchaseStatus = 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'REFUNDED'

/** Per-credit-bucket usage status (Prisma enum `PackageCreditUsageStatus`). */
export type PackageCreditUsageStatus = 'RESERVED' | 'CONSUMED' | 'RETURNED'

/**
 * Canonical price breakdown the backend's ComputePackagePriceService returns
 * alongside a package on GET. All three fields are integer halalas.
 */
export interface PackagePriceBreakdown {
  /** Sum of (paidQuantity × resolved unit price) across all items, in halalas. */
  subtotal: number
  /** Discount applied to the subtotal, in halalas. Never exceeds `subtotal`. */
  discountAmount: number
  /** max(0, subtotal − discountAmount), in halalas. */
  finalPrice: number
  /** Per-item resolved unit prices (halalas), keyed by duration option. */
  itemUnitPrices: { durationOptionId: string; unitPrice: number }[]
}

export interface SessionPackageItem {
  id: string
  packageId: string
  groupId?: string | null
  sessionPosition?: number | null
  serviceId: string
  employeeId: string
  durationOptionId: string
  paidQuantity: number
  freeQuantity: number
  sortOrder: number
  createdAt: string
}

export interface SessionPackage {
  id: string
  modelVersion?: PackageModelVersion
  groups?: PackageGroupInput[]
  globalDiscount?: GlobalDiscount
  /** Catalog owner; purchased credit eligibility is stored in its own snapshot. */
  ownerEmployeeId?: string | null
  nameAr: string
  nameEn: string | null
  descriptionAr: string | null
  descriptionEn: string | null
  imageUrl: string | null
  iconName: string | null
  iconBgColor: string | null
  discountType: DiscountType
  /**
   * Discount value. Read together with `discountType`:
   *   - PERCENTAGE → 0..100 (e.g. 10 = 10%)
   *   - FIXED      → integer halalas (e.g. 5000 = 50 SAR)
   */
  discountValue: number
  isActive: boolean
  isPublic: boolean
  sortOrder: number
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  items: SessionPackageItem[]
}

export interface PackagePurchase {
  offerSnapshot?: import("./package-family").PackageOfferSnapshot | null
  id: string
  modelVersion?: PackageModelVersion
  packageId: string
  clientId: string
  branchId: string
  status: PackagePurchaseStatus
  /** Integer halalas — subtotal frozen at purchase time. */
  subtotalSnapshot: number
  /** Integer halalas — discount applied at purchase time. */
  discountSnapshot: number
  /** Integer halalas — total actually paid at purchase time. */
  amountPaid: number
  paidAt: string
  refundedAt: string | null
  /** Integer halalas — partial refund amount (0 when not refunded). */
  refundAmount: number
  notes: string | null
  createdAt: string
  updatedAt: string
}

/**
 * A credit bucket — one row per (purchase × item). The bucket tracks the
 * service / practitioner / duration it is locked to plus the resolved
 * unit-price snapshot. A credit is consumed by individual bookings and
 * returned to the bucket on cancellation / no-show (see
 * PackageCreditUsage).
 */
export interface PackageCredit {
  id: string
  purchaseId: string
  purchaseGroupId?: string | null
  sessionPosition?: number | null
  groupLabel?: string | null
  sequenceMode?: GroupSequenceMode | null
  dependsOnGroupId?: string | null
  /** Capacity and ordering are separate: a remaining session may still be locked. */
  availability?: { bookable: boolean; reason: string | null }
  durationMinsSnapshot?: number | null
  deliveryTypeSnapshot?: 'IN_PERSON' | 'ONLINE' | null
  serviceNameSnapshot?: string | null
  employeeNameSnapshot?: string | null
  listPriceSnapshot?: number | null
  netValue?: number | null
  serviceId: string
  employeeId: string
  durationOptionId: string
  /** Integer halalas — unit price at purchase time. */
  unitPriceSnapshot: number
  totalQuantity: number
  usedQuantity: number
  /** Sessions with a booked appointment that has not happened yet. */
  reservedQuantity: number
  createdAt: string
  /**
   * Derived: `totalQuantity − usedQuantity − reservedQuantity`. Always
   * present when the credit is hydrated client-side. The backend does not
   * store this — callers compute it from the three integer fields above.
   * A reserved session is not available capacity even though it hasn't
   * been delivered yet — omitting it here would let a booked session look
   * available and get double-booked.
   */
  remaining?: number
}

export interface PackageCreditUsage {
  id: string
  creditId: string
  bookingId: string | null
  status: PackageCreditUsageStatus
  usedAt: string
  consumedAt?: string | null
  deliveredAt?: string | null
  returnedAt: string | null
}
