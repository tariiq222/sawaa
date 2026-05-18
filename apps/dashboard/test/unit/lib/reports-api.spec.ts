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

  it("fetchRevenueReport posts to /dashboard/ops/reports with type REVENUE and branchId", async () => {
    postMock.mockResolvedValueOnce({})
    await fetchRevenueReport({ dateFrom: "2026-01-01", dateTo: "2026-01-31", branchId: "branch-1" })
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/ops/reports",
      expect.objectContaining({ type: "REVENUE", from: "2026-01-01", to: "2026-01-31", branchId: "branch-1" }),
    )
  })

  it("fetchRevenueReport omits branchId when not provided", async () => {
    postMock.mockResolvedValueOnce({})
    await fetchRevenueReport({ dateFrom: "2026-01-01", dateTo: "2026-01-31" })
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/ops/reports",
      expect.not.objectContaining({ branchId: expect.anything() }),
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

  it("fetchEmployeeReport with employeeId posts employeeId in payload", async () => {
    postMock.mockResolvedValueOnce({})
    await fetchEmployeeReport({ employeeId: "p-1", dateFrom: "2026-01-01", dateTo: "2026-01-31" })
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/ops/reports",
      expect.objectContaining({ type: "EMPLOYEES", from: "2026-01-01", employeeId: "p-1" }),
    )
  })

  it("fetchEmployeeReport without employeeId omits it from payload (top-5 practitioners)", async () => {
    postMock.mockResolvedValueOnce([])
    await fetchEmployeeReport({ dateFrom: "2026-01-01", dateTo: "2026-01-31" })
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/ops/reports",
      expect.not.objectContaining({ employeeId: expect.anything() }),
    )
  })

  it("fetchEmployeeReport without employeeId returns the array from the API (top-5 practitioners)", async () => {
    const mockTop5 = [
      { employeeId: "e1", displayName: "Dr A", totalRevenue: 5000, completedBookings: 10, totalBookings: 12, averageRating: 4.5 },
      { employeeId: "e2", displayName: "Dr B", totalRevenue: 3000, completedBookings: 8, totalBookings: 10, averageRating: 4.2 },
    ]
    postMock.mockResolvedValueOnce(mockTop5)
    const result = await fetchEmployeeReport({ dateFrom: "2026-01-01", dateTo: "2026-01-31" })
    expect(result).toEqual(mockTop5)
  })
})
