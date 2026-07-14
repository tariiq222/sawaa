"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchOverviewReport } from "@/lib/api/reports"
import { fetchBookings } from "@/lib/api/bookings"
import { fetchPayments } from "@/lib/api/payments"
import { queryKeys } from "@/lib/query-keys"
import { getReportsDefaultRange } from "@/hooks/use-reports-period"
import type { VisibleWidgets } from "@/lib/dashboard-widgets"

/**
 * Aggregates the data the dashboard home needs: month-to-date KPIs (reused from
 * the overview report), today's booking count, and the two attention-alert
 * counts (pending payments, cancel requests). Each query is gated on the
 * caller's visible-widget permissions so we never fetch what won't render.
 */
export function useDashboardHome(visible: VisibleWidgets) {
  const month = getReportsDefaultRange("thisMonth")
  const today = getReportsDefaultRange("today")

  const statsEnabled =
    visible.stats.bookings || visible.stats.clients || visible.stats.revenue

  const overview = useQuery({
    queryKey: queryKeys.reports.overview({ scope: "home", from: month.from, to: month.to }),
    queryFn: () => fetchOverviewReport({ dateFrom: month.from, dateTo: month.to }),
    enabled: statsEnabled,
    staleTime: 60_000,
  })

  const todayBookings = useQuery({
    queryKey: queryKeys.bookings.list({ scope: "home-today", from: today.from }),
    queryFn: () => fetchBookings({ dateFrom: today.from, dateTo: today.to, limit: 1 }),
    enabled: visible.stats.bookings,
    staleTime: 60_000,
  })

  // Today bookings split by status — feeds the TodayPulse KPI strip
  // (pending/awaiting-payment tiles). Reuses the same today range +
  // fetchBookings + limit:1 pattern as `todayBookings`, so no new API
  // surface is introduced.
  const todayConfirmedBookings = useQuery({
    queryKey: queryKeys.bookings.list({
      scope: "home-today-confirmed",
      from: today.from,
    }),
    queryFn: () =>
      fetchBookings({
        dateFrom: today.from,
        dateTo: today.to,
        status: "confirmed",
        limit: 1,
      }),
    enabled: visible.stats.bookings,
    staleTime: 60_000,
  })

  const todayPendingBookings = useQuery({
    queryKey: queryKeys.bookings.list({
      scope: "home-today-pending",
      from: today.from,
    }),
    queryFn: () =>
      fetchBookings({
        dateFrom: today.from,
        dateTo: today.to,
        status: "pending",
        limit: 1,
      }),
    enabled: visible.stats.bookings,
    staleTime: 60_000,
  })

  const todayAwaitingPaymentBookings = useQuery({
    queryKey: queryKeys.bookings.list({
      scope: "home-today-awaiting-payment",
      from: today.from,
    }),
    queryFn: () =>
      fetchBookings({
        dateFrom: today.from,
        dateTo: today.to,
        status: "awaiting_payment",
        limit: 1,
      }),
    enabled: visible.stats.bookings,
    staleTime: 60_000,
  })

  const pendingPayments = useQuery({
    queryKey: queryKeys.payments.list({ scope: "home-pending" }),
    queryFn: () => fetchPayments({ status: "PENDING", limit: 1 }),
    enabled: visible.stats.pendingPayments || visible.attentionAlerts.pendingPayments,
    staleTime: 60_000,
  })

  const cancelRequests = useQuery({
    queryKey: queryKeys.bookings.list({ scope: "home-cancel" }),
    queryFn: () => fetchBookings({ status: "cancel_requested", limit: 1 }),
    enabled: visible.attentionAlerts.cancelRequests,
    staleTime: 60_000,
  })

  return {
    overview: overview.data,
    todayBookingsCount: todayBookings.data?.meta.total ?? 0,
    todayConfirmedCount: todayConfirmedBookings.data?.meta.total ?? 0,
    todayPendingCount: todayPendingBookings.data?.meta.total ?? 0,
    todayAwaitingPaymentCount: todayAwaitingPaymentBookings.data?.meta.total ?? 0,
    pendingPaymentsCount: pendingPayments.data?.meta.total ?? 0,
    cancelRequestsCount: cancelRequests.data?.meta.total ?? 0,
    isLoading: statsEnabled && overview.isLoading,
  }
}
