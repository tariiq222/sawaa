"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchDashboardStats } from "@/lib/api/dashboard-stats"
import { fetchOverviewReport } from "@/lib/api/reports"
import { queryKeys } from "@/lib/query-keys"
import { getReportsDefaultRange } from "@/hooks/use-reports-period"
import type { VisibleWidgets } from "@/lib/dashboard-widgets"

/**
 * Aggregates the data the dashboard home needs:
 *  - Month-to-date KPIs (from the overview report — unchanged)
 *  - Today's counts + attention-alert counts (single GET /dashboard/stats
 *    request, replacing the 7 separate `limit: 1` booking list queries
 *    that previously fanned out from the home page)
 *
 * Each query is gated on the caller's visible-widget permissions so we never
 * fetch what won't render.
 */
export function useDashboardHome(visible: VisibleWidgets) {
  const month = getReportsDefaultRange("thisMonth")

  const statsEnabled =
    visible.stats.bookings || visible.stats.clients || visible.stats.revenue

  const overview = useQuery({
    queryKey: queryKeys.reports.overview({ scope: "home", from: month.from, to: month.to }),
    queryFn: () => fetchOverviewReport({ dateFrom: month.from, dateTo: month.to }),
    enabled: statsEnabled,
    staleTime: 60_000,
  })

  // Single stats call replaces the previous fan-out (4 bookings + 2 payments
  // queries, each with limit: 1 just to read meta.total). Backend groups by
  // status in one DB query.
  const homeStats = useQuery({
    queryKey: queryKeys.reports.dashboardHome(),
    queryFn: () => fetchDashboardStats(),
    enabled: statsEnabled,
    staleTime: 60_000,
  })

  return {
    overview: overview.data,
    todayBookingsCount: homeStats.data?.todayBookings ?? 0,
    todayConfirmedCount: homeStats.data?.confirmedToday ?? 0,
    todayPendingCount: homeStats.data?.pendingToday ?? 0,
    todayAwaitingPaymentCount: homeStats.data?.awaitingPaymentToday ?? 0,
    pendingPaymentsCount: homeStats.data?.pendingPayments ?? 0,
    cancelRequestsCount: homeStats.data?.cancelRequests ?? 0,
    isLoading: statsEnabled && (overview.isLoading || homeStats.isLoading),
  }
}