import type { PackageCredit, PackagePurchaseStatus } from './session-package'
import type { PackageOfferSnapshot } from './package-family'
export interface ClientPackageCredit extends Omit<PackageCredit, 'serviceId' | 'employeeId' | 'durationOptionId' | 'createdAt' | 'purchaseId'> {
  serviceId: string | null
  employeeId: string | null
  durationOptionId: string | null
  serviceNameAr: string
  serviceNameEn: string | null
  employeeNameAr: string
  employeeNameEn: string | null
  durationLabelAr: string
  durationLabelEn: string | null
  durationMins: number | null
  serviceIsBookable: boolean
  remaining: number
  constraints: { dimension: string; mode: string; targetIds: string[] }[]
}
export interface ClientPackagePurchase {
  id: string
  packageId: string
  packageNameAr: string
  packageNameEn: string | null
  offerSnapshot?: PackageOfferSnapshot | null
  modelVersion: 'LEGACY' | 'GROUPED_V2'
  status: PackagePurchaseStatus
  subtotalSnapshot: number
  discountSnapshot: number
  amountPaid: number
  /** VAT on the purchase invoice (halalas); 0 when VAT is not enabled. */
  vatAmount?: number
  /** What the client was charged: the invoice total, VAT-inclusive (halalas). */
  totalCharged?: number
  refundAmount: number
  paidAt: string
  refundedAt: string | null
  createdAt: string
  credits: ClientPackageCredit[]
}
export interface InitPackagePurchaseInput {
  packageId: string
  packageFamilyId?: string
  branchId: string
  idempotencyKey: string
}
export interface InitPackagePurchaseResponse {
  purchaseId: string
  invoiceId: string
  paymentId: string
  redirectUrl: string
}
export interface BookMyPackageCreditInput {
  creditId: string
  branchId: string
  scheduledAt: string
  serviceId?: string
  employeeId?: string
  durationOptionId?: string
  deliveryType?: 'IN_PERSON' | 'ONLINE'
  notes?: string
}
