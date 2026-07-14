/**
 * useDashboardHome — today bookings counts (focused)
 *
 * Extends the existing aggregator with three new queries for today:
 *  - confirmed
 *  - pending
 *  - awaiting_payment
 *
 * All three reuse `fetchBookings` and `getReportsDefaultRange("today")` —
 * no new API surface is introduced. They are gated on the existing
 * `visible.stats.bookings` flag (booking-read permission) so an
 * employee without booking read still gets the same gating behavior
 * as the rest of the dashboard home aggregator.
 *
 * This spec is intentionally separate from `use-dashboard-home.spec.tsx`,
 * which is already at 336/350 lines. Do not migrate these into the
 * existing spec without first expanding the file-size cap.
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
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
  Wrapper.displayName = "Wrapper"
  return { Wrapper, qc: queryClient }
}

beforeEach(() => {
  vi.clearAllMocks()
})

function defaultBookingsImpl() {
  return vi.fn(async (p: Record<string, unknown>) => {
    if (p.status === "confirmed") return { items: [], meta: { total: 3 } }
    if (p.status === "pending") return { items: [], meta: { total: 5 } }
    if (p.status === "awaiting_payment")
      return { items: [], meta: { total: 2 } }
    if (p.status === "cancel_requested")
      return { items: [], meta: { total: 0 } }
    return { items: [], meta: { total: 10 } }
  })
}

describe("useDashboardHome — today bookings counts", () => {
  it("returns today confirmed, pending, awaiting_payment counts from fetchBookings", async () => {
    fetchBookings.mockImplementation(defaultBookingsImpl())
    fetchOverviewReport.mockResolvedValueOnce({})
    fetchPayments.mockResolvedValueOnce({ items: [], meta: { total: 0 } })

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useDashboardHome(ALL_VISIBLE), {
      wrapper: Wrapper,
    })

    await waitFor(() => expect(result.current.todayConfirmedCount).toBe(3))
    expect(result.current.todayPendingCount).toBe(5)
    expect(result.current.todayAwaitingPaymentCount).toBe(2)
    // todayBookingsCount (already covered by existing spec) still works
    expect(result.current.todayBookingsCount).toBe(10)
  })

  it("fires three additional fetchBookings calls for today with status filters and limit:1", async () => {
    fetchBookings.mockImplementation(defaultBookingsImpl())
    fetchOverviewReport.mockResolvedValueOnce({})
    fetchPayments.mockResolvedValueOnce({ items: [], meta: { total: 0 } })

    const { Wrapper } = makeWrapper()
    renderHook(() => useDashboardHome(ALL_VISIBLE), { wrapper: Wrapper })

    await waitFor(() => expect(fetchBookings).toHaveBeenCalled())

    // Today-scoped status queries: dateFrom === dateTo === today, limit:1, with
    // a status filter (cancel_requested is its own query and is NOT today-scoped
    // — verified separately by the existing use-dashboard-home.spec.tsx).
    const todayStatusCalls = fetchBookings.mock.calls
      .map((c) => c[0] as Record<string, unknown>)
      .filter(
        (p) =>
          typeof p.status === "string" &&
          p.dateFrom &&
          p.dateFrom === p.dateTo &&
          p.limit === 1,
      )

    const statuses = todayStatusCalls.map((p) => p.status).sort()
    expect(statuses).toEqual(
      ["awaiting_payment", "confirmed", "pending"].sort(),
    )
  })

  it("does NOT fire status-bucket queries when bookings stat is hidden", async () => {
    fetchBookings.mockResolvedValue({ items: [], meta: { total: 0 } })

    // Only the new today status-bucket queries must NOT fire. We use the
    // canonical ALL_HIDDEN shape so that no other booking query (today total,
    // cancel requests, etc.) is enabled either — giving the assertion a clean
    // baseline.
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useDashboardHome(ALL_HIDDEN), {
      wrapper: Wrapper,
    })

    // Give TanStack a tick to attempt any enabled query.
    await new Promise((r) => setTimeout(r, 10))

    expect(fetchBookings).not.toHaveBeenCalled()
    expect(result.current.todayConfirmedCount).toBe(0)
    expect(result.current.todayPendingCount).toBe(0)
    expect(result.current.todayAwaitingPaymentCount).toBe(0)
  })

  it("returns 0 counts while data is loading", () => {
    fetchOverviewReport.mockReturnValueOnce(new Promise(() => undefined))
    fetchBookings.mockReturnValue(new Promise(() => undefined))
    fetchPayments.mockReturnValue(new Promise(() => undefined))

    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useDashboardHome(ALL_VISIBLE), {
      wrapper: Wrapper,
    })

    expect(result.current.todayConfirmedCount).toBe(0)
    expect(result.current.todayPendingCount).toBe(0)
    expect(result.current.todayAwaitingPaymentCount).toBe(0)
  })
})