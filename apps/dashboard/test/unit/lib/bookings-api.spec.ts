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
} from "@/lib/api/bookings"

describe("bookings api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchBookings sends filters to /dashboard/bookings", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchBookings({ page: 1, status: "confirmed", type: "individual", deliveryType: "online" })
    expect(getMock).toHaveBeenCalledWith(
      "/dashboard/bookings",
      expect.objectContaining({ status: "confirmed", bookingType: "individual", deliveryType: "online" }),
    )
  })

  it("fetchBooking calls /dashboard/bookings/:id", async () => {
    getMock.mockResolvedValueOnce({ id: "bk-1" })
    await fetchBooking("bk-1")
    expect(getMock).toHaveBeenCalledWith("/dashboard/bookings/bk-1")
  })

  it("createBooking adapts {date,startTime} (Asia/Riyadh wall-clock) to ISO scheduledAt for the backend DTO", async () => {
    postMock.mockResolvedValueOnce({ id: "bk-1" })
    await createBooking({
      serviceId: "svc-1",
      employeeId: "emp-1",
      type: "individual",
      deliveryType: "in_person",
      date: "2026-04-01",
      startTime: "10:00",
    })
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/bookings",
      expect.objectContaining({
        serviceId: "svc-1",
        scheduledAt: "2026-04-01T07:00:00.000Z",
        bookingType: "INDIVIDUAL",
      }),
    )
    const sent = postMock.mock.calls[0][1] as Record<string, unknown>
    expect(sent).not.toHaveProperty("date")
    expect(sent).not.toHaveProperty("startTime")
    expect(sent).not.toHaveProperty("type")
  })

  it("rescheduleBooking patches newScheduledAt expected by RescheduleBookingDto", async () => {
    patchMock.mockResolvedValueOnce({ id: "bk-1" })
    await rescheduleBooking("bk-1", { date: "2026-04-01", startTime: "10:00" })
    expect(patchMock).toHaveBeenCalledWith(
      "/dashboard/bookings/bk-1/reschedule",
      { newScheduledAt: "2026-04-01T07:00:00.000Z" },
    )
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
})
