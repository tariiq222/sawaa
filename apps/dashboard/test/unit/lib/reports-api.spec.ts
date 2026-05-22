import { beforeEach, describe, expect, it, vi } from "vitest"

const { postMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { post: postMock },
  getAccessToken: vi.fn().mockReturnValue(null),
}))

import {
  fetchBookingReport,
  fetchClientsReport,
  fetchOverviewReport,
  fetchPractitionerDetail,
  fetchPractitionersReport,
  fetchRatingsReport,
  fetchRevenueReport,
  fetchServicesReport,
} from "@/lib/api/reports"

describe("reports api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("posts type=OVERVIEW for fetchOverviewReport", async () => {
    postMock.mockResolvedValueOnce({})
    await fetchOverviewReport({ dateFrom: "2026-01-01", dateTo: "2026-01-31" })
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/ops/reports",
      expect.objectContaining({ type: "OVERVIEW", from: "2026-01-01" }),
    )
  })

  it("posts type=REVENUE with branchId when provided", async () => {
    postMock.mockResolvedValueOnce({})
    await fetchRevenueReport({
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      branchId: "branch-1",
    })
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/ops/reports",
      expect.objectContaining({
        type: "REVENUE",
        from: "2026-01-01",
        to: "2026-01-31",
        branchId: "branch-1",
      }),
    )
  })

  it("posts type=BOOKINGS", async () => {
    postMock.mockResolvedValueOnce({})
    await fetchBookingReport({ dateFrom: "2026-01-01", dateTo: "2026-01-31" })
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/ops/reports",
      expect.objectContaining({ type: "BOOKINGS" }),
    )
  })

  it("posts type=CLIENTS", async () => {
    postMock.mockResolvedValueOnce({})
    await fetchClientsReport({ dateFrom: "2026-01-01", dateTo: "2026-01-31" })
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/ops/reports",
      expect.objectContaining({ type: "CLIENTS" }),
    )
  })

  it("posts type=EMPLOYEES for practitioners list", async () => {
    postMock.mockResolvedValueOnce({})
    await fetchPractitionersReport({
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    })
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/ops/reports",
      expect.objectContaining({ type: "EMPLOYEES" }),
    )
  })

  it("posts type=EMPLOYEES with employeeId for practitioner detail", async () => {
    postMock.mockResolvedValueOnce({})
    await fetchPractitionerDetail({
      employeeId: "p-1",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    })
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/ops/reports",
      expect.objectContaining({ type: "EMPLOYEES", employeeId: "p-1" }),
    )
  })

  it("posts type=SERVICES", async () => {
    postMock.mockResolvedValueOnce({})
    await fetchServicesReport({ dateFrom: "2026-01-01", dateTo: "2026-01-31" })
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/ops/reports",
      expect.objectContaining({ type: "SERVICES" }),
    )
  })

  it("posts type=RATINGS", async () => {
    postMock.mockResolvedValueOnce({})
    await fetchRatingsReport({ dateFrom: "2026-01-01", dateTo: "2026-01-31" })
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/ops/reports",
      expect.objectContaining({ type: "RATINGS" }),
    )
  })

  it("forwards compareWithPrevious flag", async () => {
    postMock.mockResolvedValueOnce({})
    await fetchOverviewReport({
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      compareWithPrevious: true,
    })
    expect(postMock).toHaveBeenCalledWith(
      "/dashboard/ops/reports",
      expect.objectContaining({ compareWithPrevious: true }),
    )
  })
})
