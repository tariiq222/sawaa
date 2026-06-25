import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: vi.fn() },
}))

import { fetchPackageReport } from "@/lib/api/package-reports"
import type {
  PackageReport,
  PackageReportType,
} from "@/lib/types/package-report"

describe("package-reports api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchPackageReport GETs the reports/packages endpoint with the 3 query params", async () => {
    getMock.mockResolvedValueOnce({
      kind: "SALES",
      purchaseCount: 0,
      totalRevenue: 0,
      byBucket: { cash: 0, network: 0, electronic: 0 },
      byMethod: [],
    })
    await fetchPackageReport({
      report: "SALES",
      from: "2026-01-01",
      to: "2026-01-31",
    })
    expect(getMock).toHaveBeenCalledWith("/dashboard/ops/reports/packages", {
      report: "SALES",
      from: "2026-01-01",
      to: "2026-01-31",
    })
  })

  it.each<PackageReportType>([
    "SALES",
    "OUTSTANDING_CREDIT",
    "CONSUMPTION",
    "REFUNDED",
  ])("forwards the report discriminator verbatim — %s", async (report) => {
    getMock.mockResolvedValueOnce(null)
    await fetchPackageReport({ report, from: "2026-02-01", to: "2026-02-28" })
    const [, params] = getMock.mock.calls[0]
    expect(params).toEqual({ report, from: "2026-02-01", to: "2026-02-28" })
  })

  it("returns the discriminator-tagged union (SALES shape)", async () => {
    const payload: PackageReport = {
      kind: "SALES",
      purchaseCount: 7,
      totalRevenue: 1234500,
      byBucket: { cash: 100000, network: 200000, electronic: 934500 },
      byMethod: [
        { method: "CASH", amount: 100000, count: 2 },
        { method: "MADA", amount: 200000, count: 3 },
        { method: "ONLINE_CARD", amount: 934500, count: 2 },
      ],
    }
    getMock.mockResolvedValueOnce(payload)
    const result = await fetchPackageReport({
      report: "SALES",
      from: "2026-01-01",
      to: "2026-01-31",
    })
    expect(result.kind).toBe("SALES")
    if (result.kind === "SALES") {
      expect(result.purchaseCount).toBe(7)
      expect(result.totalRevenue).toBe(1234500)
      expect(result.byBucket).toEqual(payload.byBucket)
      expect(result.byMethod).toEqual(payload.byMethod)
    }
  })

  it("forwards a non-default report type (CONSUMPTION) without coercion", async () => {
    getMock.mockResolvedValueOnce({
      kind: "CONSUMPTION",
      totalConsumed: 0,
      byEmployee: [],
    })
    await fetchPackageReport({
      report: "CONSUMPTION",
      from: "2026-01-01",
      to: "2026-01-31",
    })
    const [, params] = getMock.mock.calls[0]
    expect(params.report).toBe("CONSUMPTION")
  })
})
