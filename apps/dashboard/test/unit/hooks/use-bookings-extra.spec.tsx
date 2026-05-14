import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const apiMocks = vi.hoisted(() => ({
  fetchBookings: vi.fn(),
  createBooking: vi.fn(),
  rescheduleBooking: vi.fn(),
  confirmBooking: vi.fn(),
  completeBooking: vi.fn(),
  markNoShow: vi.fn(),
  checkInBooking: vi.fn(),
  adminCancelBooking: vi.fn(),
  createRecurringBooking: vi.fn(),
}))

vi.mock("@/lib/api/bookings", () => apiMocks)

import { useBookings, useBookingMutations } from "@/hooks/use-bookings"

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
  Wrapper.displayName = "Wrapper"
  return { Wrapper, qc }
}

describe("useBookings — hasFilters + page management", () => {
  beforeEach(() => { Object.values(apiMocks).forEach((m) => m.mockReset()) })

  it("hasFilters is false on initial state", async () => {
    apiMocks.fetchBookings.mockResolvedValue({ items: [], meta: { total: 0 } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBookings(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.hasFilters).toBe(false)
  })

  it("hasFilters is true once any filter is set", async () => {
    apiMocks.fetchBookings.mockResolvedValue({ items: [], meta: { total: 0 } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBookings(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => { result.current.setFilters({ search: "Sara" }) })
    expect(result.current.hasFilters).toBe(true)
  })

  it("hasFilters flips per individual filter dimension", async () => {
    apiMocks.fetchBookings.mockResolvedValue({ items: [], meta: { total: 0 } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBookings(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => { result.current.setFilters({ employeeId: "e-1" }) })
    expect(result.current.hasFilters).toBe(true)
    act(() => { result.current.resetFilters() })
    expect(result.current.hasFilters).toBe(false)

    act(() => { result.current.setFilters({ dateFrom: "2026-01-01" }) })
    expect(result.current.hasFilters).toBe(true)
    act(() => { result.current.resetFilters() })

    act(() => { result.current.setFilters({ isGuest: true }) })
    expect(result.current.hasFilters).toBe(true)
  })

  it("setFilters always resets page to 1 even when page is mid-pagination", async () => {
    apiMocks.fetchBookings.mockResolvedValue({ items: [], meta: { total: 0 } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBookings(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => { result.current.setPage(7) })
    act(() => { result.current.setFilters({ status: "confirmed" }) })
    await waitFor(() =>
      expect(apiMocks.fetchBookings).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, status: "confirmed" }),
      ),
    )
  })

  it("setPage drives the list query without changing other filters", async () => {
    apiMocks.fetchBookings.mockResolvedValue({ items: [], meta: { total: 0 } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBookings(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => { result.current.setFilters({ search: "Ali" }) })
    act(() => { result.current.setPage(3) })
    await waitFor(() =>
      expect(apiMocks.fetchBookings).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 3, search: "Ali" }),
      ),
    )
  })

  it("'all' sentinel values are scrubbed from the API query", async () => {
    apiMocks.fetchBookings.mockResolvedValue({ items: [], meta: { total: 0 } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBookings(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const firstCall = apiMocks.fetchBookings.mock.calls[0][0]
    expect(firstCall.status).toBeUndefined()
    expect(firstCall.type).toBeUndefined()
    expect(firstCall.isGuest).toBeUndefined()
  })
})

describe("useBookingMutations — recurringMut", () => {
  beforeEach(() => { Object.values(apiMocks).forEach((m) => m.mockReset()) })

  it("calls createRecurringBooking with the payload and invalidates the bookings cache", async () => {
    apiMocks.createRecurringBooking.mockResolvedValue({ id: "bk-r-1" })
    const { Wrapper, qc } = makeWrapper()
    const spy = vi.spyOn(qc, "invalidateQueries")
    const { result } = renderHook(() => useBookingMutations(), { wrapper: Wrapper })
    await result.current.recurringMut.mutateAsync({
      serviceId: "s-1",
      employeeId: "e-1",
      startDate: "2026-05-01",
      frequency: "weekly",
      count: 4,
    } as never)
    expect(apiMocks.createRecurringBooking).toHaveBeenCalledWith(
      expect.objectContaining({ frequency: "weekly", count: 4 }),
      expect.anything(),
    )
    expect(spy).toHaveBeenCalledWith({ queryKey: ["bookings"] })
  })
})
