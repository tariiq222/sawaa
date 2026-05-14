import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock, deleteMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
  putMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock, patch: patchMock, delete: deleteMock, put: putMock },
}))

import {
  fetchActivityLogs,
} from "@/lib/api/activity-log"

import {
  fetchWaitlist,
  removeWaitlistEntry,
} from "@/lib/api/waitlist"

describe("activity-log api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchActivityLogs calls /activity-log", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: {} })
    await fetchActivityLogs()
    expect(getMock).toHaveBeenCalledWith("/dashboard/ops/activity", expect.anything())
  })

})

describe("waitlist api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchWaitlist calls /bookings/waitlist", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchWaitlist()
    expect(getMock).toHaveBeenCalledWith("/dashboard/bookings/waitlist", undefined)
  })

  it("removeWaitlistEntry deletes /bookings/waitlist/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await removeWaitlistEntry("wl-1")
    expect(deleteMock).toHaveBeenCalledWith("/dashboard/bookings/waitlist/wl-1")
  })
})

