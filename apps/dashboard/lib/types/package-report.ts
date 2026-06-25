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
  totalRevenue: number
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
}

/* ─── CONSUMPTION ─── */

export interface PackageConsumptionRow {
  employeeId: string
  name: string
  count: number
}

export interface PackageConsumptionReport {
  kind: "CONSUMPTION"
  totalConsumed: number
  byEmployee: PackageConsumptionRow[]
}

/* ─── REFUNDED ─── */

export interface RefundedPackageRow {
  purchaseId: string
  packageId: string
  clientId: string
  amountPaid: number
  refundAmount: number
  refundedAt: string
  notes: string | null
}

export interface RefundedPackagesReport {
  kind: "REFUNDED"
  refundedCount: number
  totalRefunded: number
  items: RefundedPackageRow[]
}

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
