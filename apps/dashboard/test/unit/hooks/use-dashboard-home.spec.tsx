/**
 * useDashboardHome — unit tests
 *
 * The dashboard home aggregator composes 4 queries behind `enabled` flags
 * derived from a VisibleWidgets visibility map. Each subquery MUST only
 * fire when its visibility flag is true (and MUST pass the right filters).
 *
 * We assert:
 *  - The 4 query keys + filters are constructed correctly per visibility
 *  - `enabled` is correctly computed for each subquery from the visibility map
 *    (false → no fetch; true → fetch with right params)
 *  - The aggregator returns counts from the per-query meta.total fallbacks
 *  - `isLoading` is true only when stats are enabled AND the overview query
 *    is still loading (per the spec)
 */

import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { fetchOverviewReport, fetchBookings, fetchPayments } = vi.hoisted(() => ({
  fetchOverviewReport: vi.fn(),
  fetchBookings: vi.fn(),
  fetchPayments: vi.fn(),
}))

vi.mock("@/lib/api/reports", () => ({
  fetchOverviewReport,
}))

vi.mock("@/lib/api/bookings", () => ({
  fetchBookings,
}))

vi.mock("@/lib/api/payments", () => ({
  fetchPayments,
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

// Pin "today" so the overview query key range is deterministic.
// `getReportsDefaultRange("thisMonth")` returns {from: month-start, to: today}
// and `getReportsDefaultRange("today")` returns {from: today, to: today}.
// We use any date — the hook will use whatever Date returns at test runtime.
beforeEach(() => {
  vi.clearAllMocks()
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
    // The thisMonth range starts on the 1st of the current month
    expect(params.dateFrom.endsWith("-01")).toBe(true)
  })

  it("calls fetchBookings({dateFrom, dateTo, limit:1}) for today when bookings stat is visible", async () => {
    fetchBookings.mockResolvedValueOnce({ items: [], meta: { total: 7 } })

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useDashboardHome(ALL_VISIBLE), {
      wrapper: Wrapper,
    })

    await waitFor(() =>
      expect(result.current.todayBookingsCount).toBeGreaterThanOrEqual(0),
    )

    const callsForToday = fetchBookings.mock.calls.filter((c) => {
      const p = c[0] as Record<string, unknown>
      return p.dateFrom && p.dateTo && p.dateFrom === p.dateTo && p.limit === 1
    })
    expect(callsForToday.length).toBeGreaterThanOrEqual(1)
  })

  it("calls fetchBookings({status: cancel_requested, limit:1}) when cancelRequests alert is visible", async () => {
    fetchBookings.mockResolvedValueOnce({ items: [], meta: { total: 2 } })

    const { Wrapper } = makeWrapper()
    renderHook(() => useDashboardHome(ALL_VISIBLE), { wrapper: Wrapper })

    await waitFor(() => expect(fetchBookings).toHaveBeenCalled())

    const cancelCalls = fetchBookings.mock.calls.filter((c) => {
      const p = c[0] as Record<string, unknown>
      return p.status === "cancel_requested" && p.limit === 1
    })
    expect(cancelCalls.length).toBe(1)
  })

  it("calls fetchPayments({status: PENDING, limit:1}) when pendingPayments is visible", async () => {
    fetchPayments.mockResolvedValueOnce({ items: [], meta: { total: 3 } })

    const { Wrapper } = makeWrapper()
    renderHook(() => useDashboardHome(ALL_VISIBLE), { wrapper: Wrapper })

    await waitFor(() => expect(fetchPayments).toHaveBeenCalledTimes(1))
    expect(fetchPayments).toHaveBeenCalledWith({
      status: "PENDING",
      limit: 1,
    })
  })
})

describe("useDashboardHome — enabled flags", () => {
  it("does NOT call any api when ALL widgets are hidden", async () => {
    const { Wrapper } = makeWrapper()
    renderHook(() => useDashboardHome(ALL_HIDDEN), { wrapper: Wrapper })

    // Give TanStack a tick to attempt any enabled query
    await new Promise((r) => setTimeout(r, 10))

    expect(fetchOverviewReport).not.toHaveBeenCalled()
    expect(fetchBookings).not.toHaveBeenCalled()
    expect(fetchPayments).not.toHaveBeenCalled()
  })

  it("still calls fetchBookings (today) when bookings stat is the only visible widget", async () => {
    fetchBookings.mockResolvedValueOnce({ items: [], meta: { total: 0 } })

    const visible: VisibleWidgets = {
      ...ALL_HIDDEN,
      stats: { ...ALL_HIDDEN.stats, bookings: true },
    }

    const { Wrapper } = makeWrapper()
    renderHook(() => useDashboardHome(visible), { wrapper: Wrapper })

    await waitFor(() => expect(fetchBookings).toHaveBeenCalled())

    // overview also fires because any stat visible enables statsEnabled
    expect(fetchOverviewReport).toHaveBeenCalled()
    // payments does NOT fire — no payments-related flag is true
    expect(fetchPayments).not.toHaveBeenCalled()
  })

  it("fires fetchPayments only when pendingPayments (stat OR attentionAlert) is visible", async () => {
    // Case A: stat.pendingPayments = true, attentionAlerts.pendingPayments = false
    fetchPayments.mockResolvedValueOnce({ items: [], meta: { total: 1 } })

    let { Wrapper } = makeWrapper()
    renderHook(
      () =>
        useDashboardHome({
          ...ALL_HIDDEN,
          stats: { ...ALL_HIDDEN.stats, pendingPayments: true },
        }),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(fetchPayments).toHaveBeenCalledTimes(1))

    // Case B: only the attention-alert pendingPayments is true (stat hidden)
    fetchPayments.mockClear()
    fetchPayments.mockResolvedValueOnce({ items: [], meta: { total: 1 } })

    ;({ Wrapper } = makeWrapper())
    renderHook(
      () =>
        useDashboardHome({
          ...ALL_HIDDEN,
          attentionAlerts: { ...ALL_HIDDEN.attentionAlerts, pendingPayments: true },
        }),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(fetchPayments).toHaveBeenCalledTimes(1))
  })

  it("fires fetchBookings(cancel_requested) only when attentionAlerts.cancelRequests is true", async () => {
    fetchBookings.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { Wrapper } = makeWrapper()
    renderHook(
      () =>
        useDashboardHome({
          ...ALL_HIDDEN,
          attentionAlerts: { ...ALL_HIDDEN.attentionAlerts, cancelRequests: true },
        }),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(fetchBookings).toHaveBeenCalled())

    // The only call must be the cancel-requested one
    expect(fetchBookings).toHaveBeenCalledTimes(1)
    expect(fetchBookings).toHaveBeenCalledWith({
      status: "cancel_requested",
      limit: 1,
    })
  })
})

describe("useDashboardHome — result aggregation", () => {
  it("returns 0 counts while data is loading", async () => {
    // Never resolve — keep the queries in pending state.
    fetchOverviewReport.mockReturnValueOnce(new Promise(() => undefined))
    fetchBookings.mockReturnValue(new Promise(() => undefined))
    fetchPayments.mockReturnValue(new Promise(() => undefined))

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useDashboardHome(ALL_VISIBLE), {
      wrapper: Wrapper,
    })

    // Synchronous assertion before any data resolves
    expect(result.current.todayBookingsCount).toBe(0)
    expect(result.current.pendingPaymentsCount).toBe(0)
    expect(result.current.cancelRequestsCount).toBe(0)
    expect(result.current.overview).toBeUndefined()
  })

  it("returns the totals from each subquery's meta.total", async () => {
    fetchOverviewReport.mockResolvedValueOnce({ revenue: { total: 9_999 } })
    fetchBookings.mockImplementation(async (params: Record<string, unknown>) => {
      if (params.status === "cancel_requested") {
        return { items: [], meta: { total: 4 } }
      }
      // today call
      return { items: [], meta: { total: 12 } }
    })
    fetchPayments.mockResolvedValueOnce({ items: [], meta: { total: 6 } })

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useDashboardHome(ALL_VISIBLE), {
      wrapper: Wrapper,
    })

    await waitFor(() =>
      expect(result.current.todayBookingsCount).toBe(12),
    )
    expect(result.current.pendingPaymentsCount).toBe(6)
    expect(result.current.cancelRequestsCount).toBe(4)
    expect(result.current.overview).toEqual({ revenue: { total: 9_999 } })
  })

  it("isLoading is true only when statsEnabled AND overview is loading", async () => {
    // All-hidden: statsEnabled is false → isLoading should be false
    let { Wrapper } = makeWrapper()
    const { result: hidden } = renderHook(() => useDashboardHome(ALL_HIDDEN), {
      wrapper: Wrapper,
    })
    expect(hidden.current.isLoading).toBe(false)

    // Stats visible but overview hangs → isLoading should be true
    fetchOverviewReport.mockReturnValueOnce(new Promise(() => undefined))
    ;({ Wrapper } = makeWrapper())
    const { result: pending } = renderHook(
      () =>
        useDashboardHome({
          ...ALL_HIDDEN,
          stats: { ...ALL_HIDDEN.stats, bookings: true },
        }),
      { wrapper: Wrapper },
    )
    expect(pending.current.isLoading).toBe(true)
  })

  it("isLoading is false once the overview query resolves", async () => {
    fetchOverviewReport.mockResolvedValueOnce({})

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(
      () =>
        useDashboardHome({
          ...ALL_HIDDEN,
          stats: { ...ALL_HIDDEN.stats, bookings: true },
        }),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
  })
})
