import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchBookings,
  fetchBookingStats,
  createBooking,
  rescheduleBooking,
  confirmBooking,
  completeBooking,
  markNoShow,
  restoreNoShowBooking,
  approveCancelBooking,
  rejectCancelBooking,
  checkInBooking,
  startBooking,
  adminCancelBooking,
  deleteBooking,
  employeeCancelBooking,
  requestCancellation,
  clientReschedule,
} = vi.hoisted(() => ({
  fetchBookings: vi.fn(),
  fetchBookingStats: vi.fn(),
  createBooking: vi.fn(),
  rescheduleBooking: vi.fn(),
  confirmBooking: vi.fn(),
  completeBooking: vi.fn(),
  markNoShow: vi.fn(),
  restoreNoShowBooking: vi.fn(),
  approveCancelBooking: vi.fn(),
  rejectCancelBooking: vi.fn(),
  checkInBooking: vi.fn(),
  startBooking: vi.fn(),
  adminCancelBooking: vi.fn(),
  deleteBooking: vi.fn(),
  employeeCancelBooking: vi.fn(),
  requestCancellation: vi.fn(),
  clientReschedule: vi.fn(),
}))

vi.mock("@/lib/api/bookings", () => ({
  fetchBookings,
  fetchBookingStats,
  createBooking,
  rescheduleBooking,
  confirmBooking,
  completeBooking,
  markNoShow,
  restoreNoShowBooking,
  approveCancelBooking,
  rejectCancelBooking,
  checkInBooking,
  startBooking,
  adminCancelBooking,
  deleteBooking,
  employeeCancelBooking,
  requestCancellation,
  clientReschedule,
}))

import { useBookingMutations } from "@/hooks/use-bookings"
import { queryKeys } from "@/lib/query-keys"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useBookingMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("confirmMut calls confirmBooking with id", async () => {
    confirmBooking.mockResolvedValueOnce({ id: "bk-1", status: "CONFIRMED" })

    const { result } = renderHook(() => useBookingMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.confirmMut.mutate("bk-1") })

    await waitFor(() =>
      expect(confirmBooking).toHaveBeenCalledWith("bk-1", expect.anything()),
    )
  })

  it("completeMut calls completeBooking with id", async () => {
    completeBooking.mockResolvedValueOnce({ id: "bk-1", status: "COMPLETED" })

    const { result } = renderHook(() => useBookingMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.completeMut.mutate("bk-1") })

    await waitFor(() =>
      expect(completeBooking).toHaveBeenCalledWith("bk-1", expect.anything()),
    )
  })

  it("cancelMut calls adminCancelBooking with id and reason", async () => {
    adminCancelBooking.mockResolvedValueOnce({ id: "bk-1", status: "CANCELLED" })

    const { result } = renderHook(() => useBookingMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.adminCancelMut.mutate({
        id: "bk-1",
        reason: "NO_SHOW",
      } as Parameters<typeof result.current.adminCancelMut.mutate>[0])
    })

    await waitFor(() =>
      expect(adminCancelBooking).toHaveBeenCalledWith(
        "bk-1",
        expect.objectContaining({ reason: "NO_SHOW" }),
      ),
    )
  })

  it("checkInMut calls checkInBooking with id", async () => {
    checkInBooking.mockResolvedValueOnce({ id: "bk-1", status: "IN_PROGRESS" })

    const { result } = renderHook(() => useBookingMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.checkInMut.mutate("bk-1") })

    await waitFor(() =>
      expect(checkInBooking).toHaveBeenCalledWith("bk-1", expect.anything()),
    )
  })

  it("rescheduleMut calls rescheduleBooking with id and payload", async () => {
    rescheduleBooking.mockResolvedValueOnce({ id: "bk-1" })

    const { result } = renderHook(() => useBookingMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.rescheduleMut.mutate({
        id: "bk-1",
        date: "2026-04-01",
        startTime: "10:00",
      } as Parameters<typeof result.current.rescheduleMut.mutate>[0])
    })

    await waitFor(() =>
      expect(rescheduleBooking).toHaveBeenCalledWith(
        "bk-1",
        expect.objectContaining({ date: "2026-04-01", startTime: "10:00" }),
      ),
    )
  })

  it("createMut calls createBooking with payload", async () => {
    createBooking.mockResolvedValueOnce({ id: "bk-new" })

    const { result } = renderHook(() => useBookingMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.createMut.mutate({
        employeeId: "p-1",
        serviceId: "svc-1",
        date: "2026-04-01",
        startTime: "09:00",
        type: "IN_PERSON",
      } as Parameters<typeof createBooking>[0])
    })

    await waitFor(() =>
      expect(createBooking).toHaveBeenCalledWith(
        expect.objectContaining({ employeeId: "p-1" }),
        expect.anything(),
      ),
    )
  })

  it("noShowMut calls markNoShow with id", async () => {
    markNoShow.mockResolvedValueOnce({ id: "bk-1", status: "NO_SHOW" })

    const { result } = renderHook(() => useBookingMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.noShowMut.mutate("bk-1") })

    await waitFor(() =>
      expect(markNoShow).toHaveBeenCalledWith("bk-1", expect.anything()),
    )
  })

  it("restoreNoShowMut calls restoreNoShowBooking with id and reason", async () => {
    restoreNoShowBooking.mockResolvedValueOnce({ id: "bk-1", status: "CONFIRMED" })

    const { result } = renderHook(() => useBookingMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.restoreNoShowMut.mutate({
        id: "bk-1",
        reason: "client arrived late",
      })
    })

    await waitFor(() =>
      expect(restoreNoShowBooking).toHaveBeenCalledWith(
        "bk-1",
        "client arrived late",
      ),
    )
  })

  it("returns consumed credit and refreshes the affected program after no-show", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidate = vi.spyOn(client, "invalidateQueries")
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const booking = {
      id: "bk-1",
      clientId: "client-1",
      employeeId: "employee-1",
      date: "2026-09-05",
      status: "no_show",
      packageFunding: { creditId: "credit-1" },
      programId: "program-1",
    }
    client.setQueryData(queryKeys.bookings.list({ page: 1 }), { items: [booking] })
    // Lifecycle responses are flat rows and omit the mapped packageFunding
    // relation; the mutation must resolve that context from the QueryClient.
    markNoShow.mockResolvedValueOnce({ id: "bk-1", status: "NO_SHOW" })

    const { result } = renderHook(() => useBookingMutations(), { wrapper })
    await act(async () => { await result.current.noShowMut.mutateAsync("bk-1") })

    const keys = invalidate.mock.calls.map(([options]) => options?.queryKey)
    expect(keys).toContainEqual(["package-purchases"])
    expect(keys).toContainEqual(["employees", "slots", "employee-1", "2026-09-05"])
    expect(keys).toContainEqual(["programs", "detail", "program-1"])
  })

  it("reclaims credit on no-show restore and refreshes the client balance", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidate = vi.spyOn(client, "invalidateQueries")
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    client.setQueryData(queryKeys.bookings.list({ page: 1 }), {
      items: [{
        id: "bk-1",
        clientId: "client-1",
        employeeId: "employee-1",
        date: "2026-09-05",
        status: "no_show",
        packageFunding: { creditId: "credit-1" },
      }],
    })
    restoreNoShowBooking.mockResolvedValueOnce({
      id: "bk-1",
      status: "confirmed",
    })

    const { result } = renderHook(() => useBookingMutations(), { wrapper })
    await act(async () => {
      await result.current.restoreNoShowMut.mutateAsync({ id: "bk-1", reason: "late" })
    })

    const keys = invalidate.mock.calls.map(([options]) => options?.queryKey)
    expect(keys).toContainEqual(["package-purchases", "client", "client-1"])
    expect(keys).toContainEqual(["credit-bookings"])
    expect(keys).toContainEqual(["reports", "bookings"])
  })
})
