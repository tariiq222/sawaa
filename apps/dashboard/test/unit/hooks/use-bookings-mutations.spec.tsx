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
  approveCancellation,
  rejectCancellation,
  checkInBooking,
  startBooking,
  adminCancelBooking,
  employeeCancelBooking,
  requestCancellation,
  createRecurringBooking,
  clientReschedule,
} = vi.hoisted(() => ({
  fetchBookings: vi.fn(),
  fetchBookingStats: vi.fn(),
  createBooking: vi.fn(),
  rescheduleBooking: vi.fn(),
  confirmBooking: vi.fn(),
  completeBooking: vi.fn(),
  markNoShow: vi.fn(),
  approveCancellation: vi.fn(),
  rejectCancellation: vi.fn(),
  checkInBooking: vi.fn(),
  startBooking: vi.fn(),
  adminCancelBooking: vi.fn(),
  employeeCancelBooking: vi.fn(),
  requestCancellation: vi.fn(),
  createRecurringBooking: vi.fn(),
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
  approveCancellation,
  rejectCancellation,
  checkInBooking,
  startBooking,
  adminCancelBooking,
  employeeCancelBooking,
  requestCancellation,
  createRecurringBooking,
  clientReschedule,
}))

import { useBookingMutations } from "@/hooks/use-bookings"

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
        reason: "No show",
      } as Parameters<typeof result.current.adminCancelMut.mutate>[0])
    })

    await waitFor(() =>
      expect(adminCancelBooking).toHaveBeenCalledWith(
        "bk-1",
        expect.objectContaining({ reason: "No show" }),
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
})
