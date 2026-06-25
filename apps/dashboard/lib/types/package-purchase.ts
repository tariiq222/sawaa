/**
 * Package Purchase Types — Sawaa Dashboard
 *
 * App-local types for the SessionPackage purchase + credit view (Phase 2 of
 * the session-packages rebuild). Mirrors the backend's
 * `ListClientPackagePurchasesHandler` response shape and the
 * `CreatePackagePurchaseDto` body. Money is integer halalas end-to-end.
 *
 * Status flow:
 *   ACTIVE     — fresh sale or partially consumed credits
 *   COMPLETED  — every credit bucket has usedQuantity === totalQuantity
 *   REFUNDED   — manual refund by the manager; `refundAmount` populated
 *
 * Note on `method` vs `paymentMethod`: the backend DTO field is `method`
 * (matches `recordPayment` / `Payment.method`), even though the
 * request-response brief sometimes reads `paymentMethod`. The backend
 * schema is authoritative — we POST `{ method }`.
 */

import type { PackageDiscountType } from "./package"

/* ─── Status ─── */

export type PackagePurchaseStatus = "ACTIVE" | "COMPLETED" | "REFUNDED"

/**
 * Mirrors the backend `PaymentMethod` enum exposed by `@prisma/client`.
 * The reception sell-package endpoint rejects `ONLINE_CARD` — that flow is
 * reserved for the Moyasar webhook (Phase 4). `COUPON` is reserved too —
 * coupons are not yet a payment method on this endpoint.
 *
 * The dashboard's `record-payment-dialog` types its own narrower union
 * (`CASH | BANK_TRANSFER | MADA | TABBY`); we reuse that list at the UI
 * layer (see sell-package-dialog.tsx) and widen only at the wire boundary.
 */
export type PackagePurchasePaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "MADA"
  | "TABBY"
  | "ONLINE_CARD"
  | "COUPON"

/* ─── Entities ─── */

/**
 * One credit bucket attached to a PackagePurchase — represents
 * `(service + employee + duration)` with a frozen unit price.
 *
 * `remaining = totalQuantity - usedQuantity` is pre-computed by the backend
 * so the dashboard's "balance" widget never has to do arithmetic on the
 * client. `serviceNameAr` / `employeeNameAr` / `durationLabelAr` are the
 * resolved display strings — the model stores cross-BC IDs as plain
 * strings, so the dashboard never has to chase FKs itself.
 */
export interface PackageCredit {
  id: string
  serviceId: string
  employeeId: string
  durationOptionId: string
  serviceNameAr: string
  serviceNameEn: string | null
  employeeNameAr: string
  employeeNameEn: string | null
  durationLabelAr: string
  /** Fallback to the canonical label since the model has no `labelEn`. */
  durationLabelEn: string | null
  durationMins: number | null
  /** Integer halalas (1 SAR = 100). */
  unitPriceSnapshot: number
  totalQuantity: number
  usedQuantity: number
  remaining: number
  /**
   * Wizard-jump fields (booking wizard credits panel). Resolved backend-side
   * from the credit's service → category → department chain so a credit card
   * can pre-fill the wizard target in one click. `serviceIsBookable` is false
   * when the service is archived/inactive or the employee is inactive.
   */
  categoryId: string | null
  categoryNameAr: string
  categoryNameEn: string | null
  categoryBookingMode: "DIRECT" | "SERVICES" | null
  departmentId: string | null
  departmentNameAr: string
  departmentNameEn: string | null
  serviceIsBookable: boolean
}

/**
 * A client's package purchase, with the purchase's snapshot fields and the
 * credits attached to it. `subtotalSnapshot` / `discountSnapshot` /
 * `amountPaid` are the frozen prices at sale time — they may differ from
 * the current `SessionPackage.finalPrice` if the catalog has been edited
 * since the sale.
 */
export interface PackagePurchase {
  id: string
  packageId: string
  packageNameAr: string
  packageNameEn: string | null
  status: PackagePurchaseStatus
  /** Integer halalas. */
  subtotalSnapshot: number
  /** Integer halalas. */
  discountSnapshot: number
  /** Integer halalas. */
  amountPaid: number
  /** Integer halalas. 0 unless status === REFUNDED. */
  refundAmount: number
  paidAt: string
  refundedAt: string | null
  notes: string | null
  createdAt: string
  credits: PackageCredit[]
}

/* ─── Write side ─── */

export interface CreatePackagePurchasePayload {
  packageId: string
  clientId: string
  branchId: string
  /**
   * Maps to the backend DTO field `method`. The dashboard sells at the desk
   * via manual payment — `ONLINE_CARD` is rejected server-side and
   * `COUPON` is not wired at this endpoint.
   */
  method: PackagePurchasePaymentMethod
  notes?: string
}

/**
 * Response from `POST /dashboard/finance/package-purchases`. The backend
 * returns the purchase row + the freshly-issued invoice + the payment id
 * + the credit buckets it just created, so the dashboard can refresh the
 * balances view without an extra GET round-trip.
 */
export interface CreatePackagePurchaseResult {
  purchase: PackagePurchase
  invoiceId: string
  paymentId: string
  credits: Array<{
    serviceId: string
    employeeId: string
    durationOptionId: string
    /** Integer halalas. */
    unitPriceSnapshot: number
    totalQuantity: number
    usedQuantity: number
  }>
}

/* ─── Query ─── */

export interface ClientPackagePurchasesQuery {
  status?: PackagePurchaseStatus
}

/**
 * Re-export of the package discount type so consumers that import
 * `package-purchase.ts` do not also need to pull `./package` for the
 * `PackageDiscountType` they reference in the price preview.
 */
export type { PackageDiscountType }
