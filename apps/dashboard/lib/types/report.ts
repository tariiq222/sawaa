/**
 * Report Types — Sawaa Dashboard
 *
 * Every RESPONSE shape is derived from the committed OpenAPI snapshot: the
 * `POST /dashboard/ops/reports` union (`Ops…ReportDto`, one per `ReportType`)
 * that the backend's builders produce. `test/unit/lib/platform-ops-type-contract.spec.ts`
 * pins each alias to its schema, so a builder change becomes a type error here.
 *
 * The query types stay local: they describe what the dashboard form collects
 * (`dateFrom` / `dateTo` / `branchId` / `compareWithPrevious`), and
 * `lib/api/reports.ts` maps them onto the documented `GenerateReportDto` body.
 */

import type { components } from "@/lib/types/api.generated"

type Schemas = components["schemas"]

/* ─── Query (client-side; mapped onto GenerateReportDto by lib/api/reports) ─── */

export interface ReportDateQuery {
  dateFrom: string
  dateTo: string
}

export interface ReportQuery extends ReportDateQuery {
  branchId?: string
  compareWithPrevious?: boolean
}

/**
 * Wraps a report with the optional previous period. The snapshot already
 * documents `previous` on every compare-capable report, so this alias is now
 * the identity on the wire shape — kept for call-site readability.
 */
export type WithPrevious<T> = T & { previous?: T }

/* ─── Per-report payloads ─── */

/** `type: OVERVIEW` (`OpsOverviewReportDto`). */
export type OverviewReport = Schemas["OpsOverviewReportDto"]

/** `type: REVENUE` (`OpsRevenueReportDto`). */
export type RevenueReport = Schemas["OpsRevenueReportDto"]

/** `type: BOOKINGS` (`OpsBookingsReportDto`). */
export type BookingReport = Schemas["OpsBookingsReportDto"]

/** `type: CLIENTS` (`OpsClientsReportDto`). */
export type ClientsReport = Schemas["OpsClientsReportDto"]

/** `type: EMPLOYEES` without an `employeeId` filter (`OpsPractitionersReportDto`). */
export type PractitionersReport = Schemas["OpsPractitionersReportDto"]

/** `type: EMPLOYEES` with an `employeeId` filter (`OpsPractitionerDetailReportDto`). */
export type PractitionerDetail = Schemas["OpsPractitionerDetailReportDto"]

/** `type: SERVICES` (`OpsServicesReportDto`). */
export type ServicesReport = Schemas["OpsServicesReportDto"]

/** `type: RATINGS` (`OpsRatingsReportDto`). */
export type RatingsReport = Schemas["OpsRatingsReportDto"]

/* ─── Vocabulary re-exports (schema-derived) ─── */

/** Payment statuses the revenue report buckets by. */
export type PaymentStatusKey = RevenueReport["byStatus"][number]["status"]

/** Client genders the clients report buckets by (includes the UNKNOWN bucket). */
export type ClientGenderKey = ClientsReport["byGender"][number]["gender"]

/** Age buckets the clients report buckets by. */
export type ClientAgeGroup = ClientsReport["byAgeGroup"][number]["group"]

/** One practitioner summary row. */
export type PractitionerRow = PractitionersReport["rows"][number]
