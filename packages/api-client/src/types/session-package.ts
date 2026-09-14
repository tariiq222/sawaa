import type { PaginatedResponse, PaginationParams } from './api'
import type {
  SessionPackage,
  SessionPackageItem,
  PackagePriceBreakdown,
  DiscountType,
  PackagePurchaseStatus,
  PackageCreditUsageStatus,
  PackageCredit,
  PackagePurchase,
  PackageCreditUsage,
  GroupedPackageInput,
  PackageGroupInput,
  PackageSessionInput,
  PackageModelVersion,
  GroupSequenceMode,
  GlobalDiscount,
} from '@sawaa/shared'

// Re-export shared types so callers can `import { SessionPackage } from '@sawaa/api-client/types'`
// without having to take a second dependency on @sawaa/shared.
export type {
  SessionPackage,
  SessionPackageItem,
  PackagePriceBreakdown,
  DiscountType,
  PackagePurchaseStatus,
  PackageCreditUsageStatus,
  PackageCredit,
  PackagePurchase,
  PackageCreditUsage,
  GroupedPackageInput,
  PackageGroupInput,
  PackageSessionInput,
  PackageModelVersion,
  GroupSequenceMode,
  GlobalDiscount,
}

/**
 * Filters for `GET /dashboard/organization/packages`. Matches
 * `ListSessionPackagesDto` in the backend — `isActive` / `isPublic` come
 * in as query strings, and the handler transforms them to booleans.
 */
export interface SessionPackageListQuery extends PaginationParams {
  isActive?: boolean
  isPublic?: boolean
  search?: string
}

export type SessionPackageListResponse = PaginatedResponse<SessionPackage>

/** Item shape used in create / update payloads (no id, no timestamps). */
export interface SessionPackageItemInput {
  serviceId: string
  employeeId: string
  durationOptionId: string
  paidQuantity: number
  freeQuantity?: number
  sortOrder?: number
}

export interface SessionPackageMetadataInput {
  nameAr: string
  nameEn?: string
  descriptionAr?: string
  descriptionEn?: string
  imageUrl?: string
  iconName?: string
  iconBgColor?: string
  isActive?: boolean
  isPublic?: boolean
  sortOrder?: number
}

export interface LegacySessionPackageInput {
  modelVersion?: 'LEGACY'
  /** Null denotes a general legacy package. */
  ownerEmployeeId?: string | null
  /** Deprecated on legacy packages; discounts live on legacy items. */
  discountType?: DiscountType
  /**
   * Integer halalas for FIXED, 0..100 for PERCENTAGE. The handler also
   * caps PERCENTAGE at 100 and FIXED at the computed subtotal — those
   * bounds are enforced server-side only.
   */
  discountValue?: number
  items: SessionPackageItemInput[]
}

export type CreateSessionPackagePayload = SessionPackageMetadataInput & (
  | LegacySessionPackageInput
  | (GroupedPackageInput & { ownerEmployeeId?: never; items?: never; discountType?: never; discountValue?: never })
)

/**
 * Update payload — every field optional. When `items` is provided it is
 * a full replacement set (delete-and-create semantics in the handler).
 */
export type UpdateSessionPackagePayload = Partial<CreateSessionPackagePayload>

/**
 * Single package enriched with the canonical computed price. Mirrors the
 * `GetSessionPackageHandler.execute()` return shape.
 */
export interface SessionPackageDetail extends SessionPackage {
  price: PackagePriceBreakdown
}

/** Response of `DELETE /dashboard/organization/packages/:id` — 204 No Content. */
export interface ArchivedSessionPackage {
  id: string
}
