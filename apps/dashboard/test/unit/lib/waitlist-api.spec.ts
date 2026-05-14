import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  deleteMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, delete: deleteMock },
}))

import { fetchWaitlist, removeWaitlistEntry } from "@/lib/api/waitlist"

describe("waitlist api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchWaitlist calls GET /dashboard/bookings/waitlist with query", async () => {
    getMock.mockResolvedValueOnce([{ id: "1", status: "waiting" }])
    await fetchWaitlist({ employeeId: "p1", status: "waiting" })
    expect(getMock).toHaveBeenCalledWith("/dashboard/bookings/waitlist", { employeeId: "p1", status: "waiting" })
  })

  it("fetchWaitlist works without query", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchWaitlist()
    expect(getMock).toHaveBeenCalledWith("/dashboard/bookings/waitlist", undefined)
  })

  it("removeWaitlistEntry calls DELETE /bookings/waitlist/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await removeWaitlistEntry("1")
    expect(deleteMock).toHaveBeenCalledWith("/dashboard/bookings/waitlist/1")
  })
})
