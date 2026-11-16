/**
 * Package Report Types — Sawaa Dashboard
 *
 * The four session-package operational reports come from
 * `GET /dashboard/ops/reports/packages?report=<type>&from=<ISO>&to=<ISO>`.
 * Every RESPONSE shape is derived from the committed OpenAPI snapshot, so the
 * builders under `apps/backend/src/modules/ops/generate-report/` and the
 * dashboard cannot drift apart. `test/unit/lib/platform-ops-type-contract.spec.ts`
 * pins each alias.
 *
 * The `report` discriminator returns a JSON body whose shape depends on the
 * chosen type, so the response is a union discriminated by `kind`. Money is
 * integer halalas end-to-end. Dates are passed in as `yyyy-MM-dd` strings and
 * become ISO ranges server-side.
 */

import type { components, paths } from "@/lib/types/api.generated"

type Schemas = components["schemas"]

/* ─── Discriminators ─── */

/** The `report` query enum on the endpoint. */
export type PackageReportType =
  paths["/api/v1/dashboard/ops/reports/packages"]["get"]["parameters"]["query"]["report"]

/* ─── SALES ─── */

/**
 * `report=SALES` (`OpsPackageSalesReportDto`).
 *
 * `totalRevenue` is a legacy alias the backend keeps for older consumers; it
 * equals `netRevenue` (gross settled package payments less cumulative refunds).
 */
export type PackageSalesReport = Schemas["OpsPackageSalesReportDto"]

/** Per-PaymentMethod breakdown. `CASH` carries no real cash off-books; `byBucket` excludes it from "electronic" so the numbers reconcile. */
export type PackageSalesMethodRow = PackageSalesReport["byMethod"][number]

/**
 * Sales-by-channel bucket the dashboard renders as a donut:
 *   cash       → CASH
 *   network    → MADA
 *   electronic → ONLINE_CARD / TABBY / BANK_TRANSFER
 */
export type PackageSalesBuckets = PackageSalesReport["byBucket"]

/* ─── OUTSTANDING_CREDIT ─── */

/** `report=OUTSTANDING_CREDIT` (`OpsPackageOutstandingCreditReportDto`). Point-in-time: the date range is accepted but ignored. */
export type OutstandingCreditReport = Schemas["OpsPackageOutstandingCreditReportDto"]

/* ─── CONSUMPTION ─── */

/** `report=CONSUMPTION` (`OpsPackageConsumptionReportDto`). */
export type PackageConsumptionReport = Schemas["OpsPackageConsumptionReportDto"]

/** One practitioner row; `attribution` appears only for legacy/mixed sources. */
export type PackageConsumptionRow = PackageConsumptionReport["byEmployee"][number]

/* ─── REFUNDED ─── */

export type PackageRefundHistoryMode =
  | Schemas["OpsRefundedPackagesEventsReportDto"]["historyMode"]
  | Schemas["OpsRefundedPackagesLegacyReportDto"]["historyMode"]

export type PackageRefundEventSource = Schemas["OpsRefundedPackageEventRowDto"]["source"]

export type PackageRefundType = Schemas["OpsRefundedPackageEventRowDto"]["refundType"]

/** One dated refund event (or an undated historical record). */
export type RefundedPackageEventRow = Schemas["OpsRefundedPackageEventRowDto"]

/** One refunded purchase in the legacy history mode. */
export type RefundedPackageLegacyRow = Schemas["OpsRefundedPackageLegacyRowDto"]

export type PackageRefundHistoryReconciliation = Schemas["OpsRefundHistoryReconciliationDto"]

/**
 * `report=REFUNDED` with reconciled history (`historyMode: EVENTS`).
 *
 * The snapshot documents `complete` as the stored boolean; the dashboard
 * narrows it to `true` here because the backend only produces this mode when
 * every purchase reconciled. That narrowing is client-side and cannot misread
 * a payload — a `false` would have arrived as the LEGACY branch instead.
 */
export type RefundedPackagesEventsReport = Schemas["OpsRefundedPackagesEventsReportDto"] & {
  historyReconciliation: Schemas["OpsRefundHistoryReconciliationDto"] & { complete: true }
}

/** `report=REFUNDED` with a legacy history (`historyMode: LEGACY`). */
export type RefundedPackagesLegacyReport = Schemas["OpsRefundedPackagesLegacyReportDto"] & {
  historyReconciliation: Schemas["OpsRefundHistoryReconciliationDto"] & { complete: false }
}

export type RefundedPackagesReport =
  | RefundedPackagesEventsReport
  | RefundedPackagesLegacyReport

/* ─── Discriminated union ─── */

export type PackageReport =
  | PackageSalesReport
  | OutstandingCreditReport
  | PackageConsumptionReport
  | RefundedPackagesReport

/* ─── Query ─── */

export interface PackageReportQuery {
  report: PackageReportType
  /** ISO 8601 date string (yyyy-MM-dd). */
  from: string
  /** ISO 8601 date string (yyyy-MM-dd). */
  to: string
}
