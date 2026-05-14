import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock, patch: patchMock },
}))

import {
  fetchBookings,
  fetchBooking,
  createBooking,
  rescheduleBooking,
  confirmBooking,
  completeBooking,
  markNoShow,
  checkInBooking,
  adminCancelBooking,
  createRecurringBooking,
} from "@/lib/api/bookings"

describe("bookings api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchBookings sends filters to /dashboard/bookings", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchBookings({ page: 1, status: "confirmed" })
    expect(getMock).toHaveBeenCalledWith("/dashboard/bookings", expect.objectContaining({ status: "confirmed" }))
  })

  it("fetchBooking calls /dashboard/bookings/:id", async () => {
    getMock.mockResolvedValueOnce({ id: "bk-1" })
    await fetchBooking("bk-1")
    expect(getMock).toHaveBeenCalledWith("/dashboard/bookings/bk-1")
  })

  it("createBooking posts to /dashboard/bookings", async () => {
    postMock.mockResolvedValueOnce({ id: "bk-1" })
    await createBooking({ serviceId: "svc-1" } as Parameters<typeof createBooking>[0])
    expect(postMock).toHaveBeenCalledWith("/dashboard/bookings", expect.objectContaining({ serviceId: "svc-1" }))
  })

  it("rescheduleBooking patches /dashboard/bookings/:id/reschedule", async () => {
    patchMock.mockResolvedValueOnce({ id: "bk-1" })
    await rescheduleBooking("bk-1", { slotStart: "2026-04-01T10:00:00Z" } as Parameters<typeof rescheduleBooking>[1])
    expect(patchMock).toHaveBeenCalledWith("/dashboard/bookings/bk-1/reschedule", expect.anything())
  })

  it("confirmBooking patches /dashboard/bookings/:id/confirm", async () => {
    patchMock.mockResolvedValueOnce({ id: "bk-1" })
    await confirmBooking("bk-1")
    expect(patchMock).toHaveBeenCalledWith("/dashboard/bookings/bk-1/confirm")
  })

  it("completeBooking patches /dashboard/bookings/:id/complete", async () => {
    patchMock.mockResolvedValueOnce({ id: "bk-1" })
    await completeBooking("bk-1")
    expect(patchMock).toHaveBeenCalledWith("/dashboard/bookings/bk-1/complete")
  })

  it("markNoShow patches /dashboard/bookings/:id/no-show", async () => {
    patchMock.mockResolvedValueOnce({ id: "bk-1" })
    await markNoShow("bk-1")
    expect(patchMock).toHaveBeenCalledWith("/dashboard/bookings/bk-1/no-show")
  })

  it("checkInBooking patches /dashboard/bookings/:id/check-in", async () => {
    patchMock.mockResolvedValueOnce({ id: "bk-1" })
    await checkInBooking("bk-1")
    expect(patchMock).toHaveBeenCalledWith("/dashboard/bookings/bk-1/check-in")
  })

  it("adminCancelBooking patches /dashboard/bookings/:id/cancel", async () => {
    patchMock.mockResolvedValueOnce({ id: "bk-1" })
    await adminCancelBooking("bk-1", {} as Parameters<typeof adminCancelBooking>[1])
    expect(patchMock).toHaveBeenCalledWith("/dashboard/bookings/bk-1/cancel", expect.anything())
  })

  it("createRecurringBooking posts to /dashboard/bookings/recurring", async () => {
    postMock.mockResolvedValueOnce([])
    await createRecurringBooking({} as Parameters<typeof createRecurringBooking>[0])
    expect(postMock).toHaveBeenCalledWith("/dashboard/bookings/recurring", expect.anything())
  })

})
