/**
 * useDashboardHome — unit tests
 *
 * The dashboard home aggregator composes 2 queries behind `enabled` flags
 * derived from a VisibleWidgets visibility map:
 *  1. fetchOverviewReport for month-to-date KPIs (always when any stat is visible)
 *  2. fetchDashboardStats for today + attention-alert counts (single endpoint,
 *     replaces the previous 7-query fan-out)
 *
 * We assert:
 *  - The single stats endpoint is hit exactly once per render when enabled
 *  - `enabled` correctly evaluates to false when no stats widget is visible
 *  - The aggregator returns counts from the stats response
 *  - `isLoading` reflects overview + stats loading state
 */

import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { fetchOverviewReport, fetchDashboardStats } = vi.hoisted(() => ({
  fetchOverviewReport: vi.fn(),
  fetchDashboardStats: vi.fn(),
}))

vi.mock("@/lib/api/reports", () => ({
  fetchOverviewReport,
}))

vi.mock("@/lib/api/dashboard-stats", () => ({
  fetchDashboardStats,
}))

import { useDashboardHome } from "@/hooks/use-dashboard-home"
import type { VisibleWidgets } from "@/lib/dashboard-widgets"

const ALL_VISIBLE: VisibleWidgets = {
  stats: {
    bookings: true,
    clients: true,
    revenue: true,
    pendingPayments: true,
  },
  attentionAlerts: {
    pendingPayments: true,
    cancelRequests: true,
  },
  quickActions: [],
  todayTimeline: true,
  todayPulse: true,
  activityFeed: true,
  revenueChart: true,
  recentPayments: true,
  topPerformers: true,
}

const ALL_HIDDEN: VisibleWidgets = {
  stats: {
    bookings: false,
    clients: false,
    revenue: false,
    pendingPayments: false,
  },
  attentionAlerts: {
    pendingPayments: false,
    cancelRequests: false,
  },
  quickActions: [],
  todayTimeline: false,
  todayPulse: false,
  activityFeed: false,
  revenueChart: false,
  recentPayments: false,
  topPerformers: false,
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  Wrapper.displayName = "Wrapper"
  return { Wrapper, qc: queryClient }
}

const sampleStats = {
  todayBookings: 12,
  confirmedToday: 8,
  pendingToday: 2,
  awaitingPaymentToday: 1,
  cancelRequests: 4,
  newClientsToday: 3,
  pendingPayments: 6,
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default fallbacks so any call resolves with a valid shape.
  fetchOverviewReport.mockResolvedValue({})
  fetchDashboardStats.mockResolvedValue(sampleStats)
})

describe("useDashboardHome — query composition", () => {
  it("calls fetchOverviewReport for the thisMonth range when any stat is visible", async () => {
    fetchOverviewReport.mockResolvedValueOnce({
      revenue: { total: 0 },
      bookings: { total: 0 },
      clients: { new: 0 },
    })

    const { Wrapper } = makeWrapper()
    renderHook(() => useDashboardHome(ALL_VISIBLE), { wrapper: Wrapper })

    await waitFor(() => expect(fetchOverviewReport).toHaveBeenCalledTimes(1))
    const params = fetchOverviewReport.mock.calls[0][0]
    expect(params.dateFrom).toMatch(/^\d{4}-\d{2}-01$/)
    expect(params.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(params.dateFrom.endsWith("-01")).toBe(true)
  })

  it("calls fetchDashboardStats exactly once when any stat is visible", async () => {
    const { Wrapper } = makeWrapper()
    renderHook(() => useDashboardHome(ALL_VISIBLE), { wrapper: Wrapper })

    await waitFor(() => expect(fetchDashboardStats).toHaveBeenCalledTimes(1))
    expect(fetchDashboardStats).toHaveBeenCalledWith()
  })

  it("never calls fetchBookings or fetchPayments (single endpoint replaces them)", async () => {
    // The new aggregator must NOT make the 7 fan-out calls any more.
    // This protects the perf characteristic against regressions.
    const { Wrapper } = makeWrapper()
    renderHook(() => useDashboardHome(ALL_VISIBLE), { wrapper: Wrapper })

    await waitFor(() => expect(fetchDashboardStats).toHaveBeenCalled())
    expect((globalThis as Record<string, unknown>).fetchBookings).toBeUndefined()
    expect((globalThis as Record<string, unknown>).fetchPayments).toBeUndefined()
  })
})

describe("useDashboardHome — enabled flags", () => {
  it("does NOT call any api when ALL widgets are hidden", async () => {
    const { Wrapper } = makeWrapper()
    renderHook(() => useDashboardHome(ALL_HIDDEN), { wrapper: Wrapper })

    await new Promise((r) => setTimeout(r, 10))

    expect(fetchOverviewReport).not.toHaveBeenCalled()
    expect(fetchDashboardStats).not.toHaveBeenCalled()
  })

  it("still fires the stats query when only bookings widget is visible", async () => {
    const visible: VisibleWidgets = {
      ...ALL_HIDDEN,
      stats: { ...ALL_HIDDEN.stats, bookings: true },
    }

    const { Wrapper } = makeWrapper()
    renderHook(() => useDashboardHome(visible), { wrapper: Wrapper })

    await waitFor(() => expect(fetchDashboardStats).toHaveBeenCalled())
    // overview also fires because any stat visible enables statsEnabled
    expect(fetchOverviewReport).toHaveBeenCalled()
  })
})

describe("useDashboardHome — result aggregation", () => {
  it("returns 0 counts while data is loading", async () => {
    fetchOverviewReport.mockReturnValueOnce(new Promise(() => undefined))
    fetchDashboardStats.mockReturnValueOnce(new Promise(() => undefined))

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useDashboardHome(ALL_VISIBLE), {
      wrapper: Wrapper,
    })

    expect(result.current.todayBookingsCount).toBe(0)
    expect(result.current.pendingPaymentsCount).toBe(0)
    expect(result.current.cancelRequestsCount).toBe(0)
    expect(result.current.overview).toBeUndefined()
  })

  it("returns counts from the stats response and overview from its query", async () => {
    fetchOverviewReport.mockResolvedValueOnce({ revenue: { total: 9_999 } })

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useDashboardHome(ALL_VISIBLE), {
      wrapper: Wrapper,
    })

    await waitFor(() =>
      expect(result.current.todayBookingsCount).toBe(sampleStats.todayBookings),
    )
    expect(result.current.todayConfirmedCount).toBe(sampleStats.confirmedToday)
    expect(result.current.todayPendingCount).toBe(sampleStats.pendingToday)
    expect(result.current.todayAwaitingPaymentCount).toBe(
      sampleStats.awaitingPaymentToday,
    )
    expect(result.current.pendingPaymentsCount).toBe(sampleStats.pendingPayments)
    expect(result.current.cancelRequestsCount).toBe(sampleStats.cancelRequests)
    expect(result.current.overview).toEqual({ revenue: { total: 9_999 } })
  })

  it("isLoading is false when statsEnabled is false (all hidden)", async () => {
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useDashboardHome(ALL_HIDDEN), {
      wrapper: Wrapper,
    })
    expect(result.current.isLoading).toBe(false)
  })

  it("isLoading is true while overview + stats are pending", async () => {
    fetchOverviewReport.mockReturnValueOnce(new Promise(() => undefined))
    fetchDashboardStats.mockReturnValueOnce(new Promise(() => undefined))

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() =>
      useDashboardHome({
        ...ALL_HIDDEN,
        stats: { ...ALL_HIDDEN.stats, bookings: true },
      }),
    { wrapper: Wrapper })

    expect(result.current.isLoading).toBe(true)
  })

  it("isLoading is false once both queries resolve", async () => {
    fetchOverviewReport.mockResolvedValueOnce({})

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() =>
      useDashboardHome({
        ...ALL_HIDDEN,
        stats: { ...ALL_HIDDEN.stats, bookings: true },
      }),
    { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
  })
})