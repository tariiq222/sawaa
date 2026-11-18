import type { paths } from './generated/openapi'
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
 * Filters for `GET /dashboard/organization/packages` (query parameters of
 * `DashboardOrganizationPackagesController_listSessionPackagesEndpoint_v1`),
 * plus the shared paging controls. `isActive`/`isPublic` arrive as query
 * strings and the handler transforms them to booleans.
 */
export type SessionPackageListQuery = PaginationParams &
  Pick<
    NonNullable<
      paths['/api/v1/dashboard/organization/packages']['get']['parameters']['query']
    >,
    'isActive' | 'isPublic'
  >

/**
 * NOT derived: the list returns `PaginatedPackagesDto` (`PackageListRowDto`
 * rows with integer-halala prices), a different contract from the shared
 * `SessionPackage` this package re-exports. Kept as the shared-typed page.
 */
export type SessionPackageListResponse = PaginatedResponse<SessionPackage>

/**
 * Item shape used in create / update payloads (no id, no timestamps).
 * NOT derived: `CreateSessionPackageItemDto` marks `freeQuantity` (default 0)
 * and `discountValue` as required, but the API accepts requests that omit both
 * — the module test and every caller omit `freeQuantity`. The snapshot is
 * therefore wrong for this request, so the type stays hand-written.
 */
export interface SessionPackageItemInput {
  serviceId: string
  employeeId: string
  durationOptionId: string
  paidQuantity: number
  freeQuantity?: number
  sortOrder?: number
}

/**
 * Local metadata slice of the create payload. NOT derived on its own: it is
 * folded into `CreateSessionPackagePayload`, whose documented body is a single
 * `CreateSessionPackageDto`.
 */
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

/**
 * Local legacy-variant slice. NOT a standalone documented body: the documented
 * `CreateSessionPackageDto` merges legacy and grouped fields via
 * `modelVersion`, so this remains a client-side variant aggregate.
 */
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

/**
 * Request body of `POST /dashboard/organization/packages`, expressed as the
 * two documented variants (`LEGACY` items vs `GROUPED_V2` groups). Kept as a
 * local union over the shared grouped input because the single documented
 * `CreateSessionPackageDto` flattens both variants.
 */
export type CreateSessionPackagePayload = SessionPackageMetadataInput & (
  | LegacySessionPackageInput
  | (GroupedPackageInput & { ownerEmployeeId?: never; items?: never; discountType?: never; discountValue?: never })
)

/**
 * Request body of `PATCH /dashboard/organization/packages/{packageId}` — the
 * documented `UpdateSessionPackageDto` makes every field optional, so this is
 * the deep-partial of the create union.
 */
export type UpdateSessionPackagePayload = Partial<CreateSessionPackagePayload>

/**
 * Single package enriched with the canonical computed price. NOT derived: it
 * extends the shared `SessionPackage` (the contract this package re-exports)
 * with the shared `PackagePriceBreakdown`; the documented
 * `PackageDetailResponseDto` uses decimal-string discount fields instead.
 */
export interface SessionPackageDetail extends SessionPackage {
  price: PackagePriceBreakdown
}

/** Response of `DELETE /dashboard/organization/packages/:id` — 204 No Content. */
export interface ArchivedSessionPackage {
  id: string
}
