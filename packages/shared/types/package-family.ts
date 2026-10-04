import type { GlobalDiscount, PackageGroupInput } from './session-package-v2'
import type { PackagePriceBreakdown, SessionPackage } from './session-package'

/** Catalog metadata is shared; each option owns a complete grouped offer. */
export interface PackageFamilyMetadata {
  nameAr: string
  nameEn?: string | null
  descriptionAr?: string | null
  descriptionEn?: string | null
  imageUrl?: string | null
  isActive?: boolean
  isPublic?: boolean
  sortOrder?: number
}
export interface PackageFamilyOptionInput {
  id?: string
  nameAr: string
  nameEn?: string | null
  isActive?: boolean
  isPublic?: boolean
  groups: PackageGroupInput[]
  globalDiscount: GlobalDiscount
}
export interface PackageFamilyInput extends PackageFamilyMetadata {
  options: PackageFamilyOptionInput[]
}
export interface PackageFamilyOption extends SessionPackage {
  familyId?: string | null
  sessionCount: number
  price: PackagePriceBreakdown
  /** Read-only catalog labels, separate from the writable session graph. */
  displayGroups?: Array<{
    key: string
    label?: string | null
    serviceNameAr: string
    serviceNameEn?: string | null
    employeeName: string
    sessions: Array<{ position: number; durationMins: number; deliveryType: 'IN_PERSON' | 'ONLINE' }>
  }>
}
export interface PackageFamily extends PackageFamilyMetadata {
  id: string
  isStandalone: boolean
  /**
   * VAT the purchase invoice adds on top of the (net) option prices, as a
   * fraction (0 unless enabled). Optional for older responses.
   */
  vatRate?: number
  options: PackageFamilyOption[]
  archivedAt?: string | null
  createdAt?: string
  updatedAt?: string
}
/** Nullable for purchases made before options existed. */
export interface PackageOfferSnapshot {
  familyId: string
  familyNameAr: string
  familyNameEn: string | null
  optionNameAr: string
  optionNameEn: string | null
  sessionCount: number
}
