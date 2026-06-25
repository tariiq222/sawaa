/**
 * Package Reports API — Sawaa Dashboard
 *
 * App-local thin client for the Phase 5 session-package operational
 * reports endpoint:
 *   GET /dashboard/ops/reports/packages?report=<type>&from=<ISO>&to=<ISO>
 *
 * The `report` query discriminator drives the response shape on the
 * server, so the dashboard's type is a discriminated union
 * (`PackageReport` in `lib/types/package-report`). Mirrors the
 * conventions of `lib/api/reports.ts` and `lib/api/credit-bookings.ts`
 * — uses the shared `api` instance so cookie-bearing refresh +
 * envelope-unwrap are inherited for free.
 */

import { api } from "@/lib/api"
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
  query: PackageReportQuery,
): Promise<PackageReport> {
  return api.get<PackageReport>("/dashboard/ops/reports/packages", {
    report: query.report,
    from: query.from,
    to: query.to,
  })
}
