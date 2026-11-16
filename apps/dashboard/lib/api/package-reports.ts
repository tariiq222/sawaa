/**
 * Package Reports API — Sawaa Dashboard
 *
 * App-local thin client for the Phase 5 session-package operational
 * reports endpoint:
 *   GET /dashboard/ops/reports/packages?report=<type>&from=<ISO>&to=<ISO>
 *
 * The `report` query discriminator drives the response shape on the server, so
 * the dashboard's type is a discriminated union (`PackageReport` in
 * `lib/types/package-report`, derived from the committed OpenAPI snapshot).
 * The call goes through the typed helper in `lib/api/openapi.ts`; query names,
 * order and the Riyadh-day conversion are unchanged.
 */

import { openApi } from "@/lib/api/openapi"
import { riyadhDayStart, riyadhDayEnd } from "@/lib/audit-date"
import type {
  PackageReport,
  PackageReportQuery,
} from "@/lib/types/package-report"

/**
 * Fetch a single session-package report. The date range is optional
 * for the OUTSTANDING_CREDIT type (a point-in-time liability) but
 * always accepted — the server normalises a reversed range.
 */
export async function fetchPackageReport(
  query: PackageReportQuery
): Promise<PackageReport> {
  return openApi.get("/api/v1/dashboard/ops/reports/packages", {
    query: {
      report: query.report,
      from: query.from.includes("T") ? query.from : riyadhDayStart(query.from),
      to: query.to.includes("T") ? query.to : riyadhDayEnd(query.to),
    },
  }) as Promise<PackageReport>
}
