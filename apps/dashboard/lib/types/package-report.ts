/**
 * Package Report Types — Sawaa Dashboard
 *
 * App-local types for the four session-package operational reports
 * (Phase 5 of the session-packages rebuild). Mirrors the backend
 * `PackageReportsHandler` and the four `buildXxx*Report` builders
 * under `apps/backend/src/modules/ops/generate-report/`. The endpoint
 * is `GET /dashboard/ops/reports/packages?report=<type>&from=<ISO>&to=<ISO>`
 * and the `report` discriminator returns a JSON body whose shape
 * depends on the chosen type — that is why the response is a union
 * discriminated by the `kind` tag.
 *
 * Money is integer halalas end-to-end. Dates are passed in as
 * `yyyy-MM-dd` strings and become ISO ranges server-side.
 */

export type PackageReportType =
  | "SALES"
  | "OUTSTANDING_CREDIT"
  | "CONSUMPTION"
  | "REFUNDED"

/* ─── SALES ─── */

/**
 * Per-PaymentMethod breakdown. `CASH` carries no real cash off-books;
 * the bucketing in `byBucket` excludes it from "electronic" so the
 * numbers reconcile.
 */
export interface PackageSalesMethodRow {
  method: string
  amount: number
  count: number
}

/**
 * Sales-by-channel bucket the dashboard renders as a donut:
 *   cash       → CASH
 *   network    → MADA
 *   electronic → ONLINE_CARD / TABBY / BANK_TRANSFER
 */
export interface PackageSalesBuckets {
  cash: number
  network: number
  electronic: number
}

export interface PackageSalesReport {
  kind: "SALES"
  purchaseCount: number
  /** Legacy alias retained for older consumers; equals netRevenue. */
  totalRevenue: number
  grossRevenue: number
  refundedAmount: number
  netRevenue: number
  byBucket: PackageSalesBuckets
  byMethod: PackageSalesMethodRow[]
}

/* ─── OUTSTANDING_CREDIT ─── */

/**
 * Point-in-time liability — what the center still owes in pre-paid,
 * unconsumed sessions right now. The date range is accepted but
 * ignored server-side (the metric is a snapshot, not a range).
 */
export interface OutstandingCreditReport {
  kind: "OUTSTANDING_CREDIT"
  outstandingLiability: number
  outstandingSessions: number
  creditCount: number
  /** Σ reservedQuantity — outstanding sessions that already have an appointment booked. */
  reservedSessions: number
}

/* ─── CONSUMPTION ─── */

export interface PackageConsumptionRow {
  employeeId: string
  name: string
  count: number
  attribution?: "BOOKING" | "LEGACY_CREDIT" | "UNKNOWN" | "MIXED"
}

export interface PackageConsumptionReport {
  kind: "CONSUMPTION"
  totalConsumed: number
  byEmployee: PackageConsumptionRow[]
}

/* ─── REFUNDED ─── */

export type PackageRefundHistoryMode = "EVENTS" | "LEGACY"

export type PackageRefundEventSource =
  | "LIVE"
  | "LEGACY_REQUEST"
  | "LEGACY_AGGREGATE"

export type PackageRefundType = "FULL" | "PARTIAL" | "UNKNOWN"

export interface RefundedPackageEventRow {
  eventId: string
  purchaseId: string
  packageId: string | null
  clientId: string | null
  amountPaid: number | null
  refundAmount: number
  refundType: PackageRefundType
  source: PackageRefundEventSource
  occurredAt: string | null
  notes: string | null
}

export interface RefundedPackageLegacyRow {
  purchaseId: string
  packageId: string | null
  clientId: string | null
  amountPaid: number | null
  refundAmount: number
  refundedAt: string | null
  notes: string | null
}

export interface PackageRefundHistoryReconciliation {
  complete: boolean
  unresolvedPurchaseCount: number
}

export interface RefundedPackagesEventsReport {
  kind: "REFUNDED"
  historyMode: "EVENTS"
  historyReconciliation: PackageRefundHistoryReconciliation & { complete: true }
  eventCount: number
  purchaseCount: number
  totalRefunded: number
  items: RefundedPackageEventRow[]
  undatedHistorical: {
    recordCount: number
    purchaseCount: number
    totalRefunded: number
    items: RefundedPackageEventRow[]
  }
}

export interface RefundedPackagesLegacyReport {
  kind: "REFUNDED"
  historyMode: "LEGACY"
  historyReconciliation: PackageRefundHistoryReconciliation & { complete: false }
  refundedCount: number
  totalRefunded: number
  items: RefundedPackageLegacyRow[]
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
