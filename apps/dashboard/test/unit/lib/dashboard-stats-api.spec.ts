import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock },
}))

import { fetchDashboardStats, fetchTopPerformers } from "@/lib/api/dashboard-stats"

describe("dashboard-stats api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchDashboardStats hits the bare endpoint when no range is given", async () => {
    getMock.mockResolvedValueOnce({ todayBookings: 0 })
    await fetchDashboardStats()
    expect(getMock).toHaveBeenCalledWith("/dashboard/stats")
  })

  it("fetchDashboardStats appends only the provided range bound", async () => {
    getMock.mockResolvedValueOnce({ todayBookings: 0 })
    await fetchDashboardStats({ from: "2026-06-01" })
    expect(getMock).toHaveBeenCalledWith("/dashboard/stats?from=2026-06-01")
  })

  it("fetchDashboardStats appends both bounds as a query string", async () => {
    getMock.mockResolvedValueOnce({ todayBookings: 3 })
    await fetchDashboardStats({ from: "2026-06-01", to: "2026-06-30" })
    expect(getMock).toHaveBeenCalledWith("/dashboard/stats?from=2026-06-01&to=2026-06-30")
  })

  it("fetchDashboardStats ignores an empty range object", async () => {
    getMock.mockResolvedValueOnce({ todayBookings: 0 })
    await fetchDashboardStats({})
    expect(getMock).toHaveBeenCalledWith("/dashboard/stats")
  })

  it("fetchTopPerformers requests the month period", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchTopPerformers()
    expect(getMock).toHaveBeenCalledWith("/dashboard/top-performers?period=month")
  })
})
