import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock },
}))

import { fetchActivityLogs } from "@/lib/api/activity-log"

describe("activity-log api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchActivityLogs calls /activity-log with backend query params", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchActivityLogs({
      page: 1,
      perPage: 10,
      module: "bookings",
      action: "updated",
      dateFrom: "2026-04-01",
      dateTo: "2026-04-30",
    })
    expect(getMock).toHaveBeenCalledWith("/dashboard/ops/activity", {
      page: 1,
      limit: 10,
      sortBy: undefined,
      sortOrder: undefined,
      entity: "Booking",
      action: "UPDATE",
      userId: undefined,
      from: "2026-04-01",
      to: "2026-04-30",
    })
  })

  it("fetchActivityLogs works with empty query", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchActivityLogs()
    expect(getMock).toHaveBeenCalledWith("/dashboard/ops/activity", {
      page: undefined,
      limit: undefined,
      sortBy: undefined,
      sortOrder: undefined,
      entity: undefined,
      action: undefined,
      userId: undefined,
      from: undefined,
      to: undefined,
    })
  })

  it("normalizes backend activity rows for the dashboard table", async () => {
    getMock.mockResolvedValueOnce({
      items: [
        {
          id: "log-1",
          userId: "u-1",
          userEmail: "sara@example.com",
          action: "UPDATE",
          entity: "Booking",
          entityId: "booking-1",
          description: "Updated booking status",
          metadata: { oldValues: { status: "pending" }, newValues: { status: "confirmed" } },
          ipAddress: "127.0.0.1",
          userAgent: "Vitest",
          occurredAt: "2026-04-17T09:30:00.000Z",
        },
      ],
      meta: { total: 1 },
    })

    const result = await fetchActivityLogs()

    expect(result.items[0]).toMatchObject({
      id: "log-1",
      action: "updated",
      module: "Booking",
      resourceId: "booking-1",
      createdAt: "2026-04-17T09:30:00.000Z",
      oldValues: { status: "pending" },
      newValues: { status: "confirmed" },
    })
  })
})
