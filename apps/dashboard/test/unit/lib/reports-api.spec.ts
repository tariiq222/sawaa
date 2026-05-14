import { beforeEach, describe, expect, it, vi } from "vitest"

const { postMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { post: postMock },
  getAccessToken: vi.fn().mockReturnValue(null),
}))

import {
  fetchRevenueReport,
  fetchBookingReport,
  fetchEmployeeReport,
} from "@/lib/api/reports"

describe("reports api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchRevenueReport posts to /dashboard/ops/reports with type REVENUE", async () => {
    postMock.mockResolvedValueOnce({})
    await fetchRevenueReport({ dateFrom: "2026-01-01", dateTo: "2026-01-31" })
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/ops/reports",
      expect.objectContaining({ type: "REVENUE", from: "2026-01-01", to: "2026-01-31" }),
    )
  })

  it("fetchBookingReport posts to /dashboard/ops/reports with type BOOKINGS", async () => {
    postMock.mockResolvedValueOnce({})
    await fetchBookingReport({ dateFrom: "2026-01-01", dateTo: "2026-01-31" })
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/ops/reports",
      expect.objectContaining({ type: "BOOKINGS", from: "2026-01-01", to: "2026-01-31" }),
    )
  })

  it("fetchEmployeeReport posts to /dashboard/ops/reports with type EMPLOYEES", async () => {
    postMock.mockResolvedValueOnce({})
    await fetchEmployeeReport({ employeeId: "p-1", dateFrom: "2026-01-01", dateTo: "2026-01-31" })
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/ops/reports",
      expect.objectContaining({ type: "EMPLOYEES", from: "2026-01-01", employeeId: "p-1" }),
    )
  })
})
