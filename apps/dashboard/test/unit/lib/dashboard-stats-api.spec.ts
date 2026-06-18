import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock },
}))

import { fetchTopPerformers } from "@/lib/api/dashboard-stats"

describe("dashboard-stats api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchTopPerformers requests the month period", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchTopPerformers()
    expect(getMock).toHaveBeenCalledWith("/dashboard/top-performers?period=month")
  })
})
