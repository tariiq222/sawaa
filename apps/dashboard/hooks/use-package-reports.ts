"use client"

/**
 * Package Reports Hooks — Sawaa Dashboard
 *
 * TanStack Query bindings for the four session-package operational
 * reports (Phase 5):
 *   - `usePackageReport` → GET /dashboard/ops/reports/packages
 *
 * Mirrors the conventions of `hooks/use-package-purchases.ts` and
 * `hooks/use-credit-bookings.ts` — TanStack Query only, query keys
 * centralised in `lib/query-keys.ts`. The hook is gated on all three
 * query params (report, from, to) being present so callers can switch
 * report types without a stale query firing with the wrong `kind`.
 */

import { useQuery } from "@tanstack/react-query"

import { queryKeys } from "@/lib/query-keys"
import { fetchPackageReport } from "@/lib/api/package-reports"
import type {
  PackageReport,
  PackageReportQuery,
  PackageReportType,
} from "@/lib/types/package-report"

/**
 * Fetch a single package report. The hook is disabled when any of the
 * three params is missing — the backend requires a complete triple
 * for every report type.
 */
export function usePackageReport(
  report: PackageReportType | null | undefined,
  from: string,
  to: string,
) {
  const query: PackageReportQuery | null =
    report && from && to ? { report, from, to } : null

  return useQuery<PackageReport>({
    queryKey: query
      ? queryKeys.packageReports.report(query)
      : queryKeys.packageReports.all,
    queryFn: () => fetchPackageReport(query as PackageReportQuery),
    enabled: !!query,
    staleTime: 30_000,
  })
}
