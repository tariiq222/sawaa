import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { fetchPackageReport } = vi.hoisted(() => ({
  fetchPackageReport: vi.fn(),
}))

vi.mock("@/lib/api/package-reports", () => ({
  fetchPackageReport,
}))

import { usePackageReport } from "@/hooks/use-package-reports"

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("usePackageReport — gate", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("is disabled when report is null", () => {
    const { result } = renderHook(
      () => usePackageReport(null, "2026-01-01", "2026-01-31"),
      { wrapper: makeWrapper() },
    )
    expect(result.current.isLoading).toBe(false)
    expect(fetchPackageReport).not.toHaveBeenCalled()
  })

  it("is disabled when from is empty", () => {
    const { result } = renderHook(
      () => usePackageReport("SALES", "", "2026-01-31"),
      { wrapper: makeWrapper() },
    )
    expect(result.current.isLoading).toBe(false)
    expect(fetchPackageReport).not.toHaveBeenCalled()
  })

  it("is disabled when to is empty", () => {
    const { result } = renderHook(
      () => usePackageReport("SALES", "2026-01-01", ""),
      { wrapper: makeWrapper() },
    )
    expect(result.current.isLoading).toBe(false)
    expect(fetchPackageReport).not.toHaveBeenCalled()
  })
})

describe("usePackageReport — happy path", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("forwards the report / from / to triple to fetchPackageReport", async () => {
    fetchPackageReport.mockResolvedValueOnce({
      kind: "SALES",
      purchaseCount: 1,
      totalRevenue: 0,
      byBucket: { cash: 0, network: 0, electronic: 0 },
      byMethod: [],
    })
    const { result } = renderHook(
      () => usePackageReport("SALES", "2026-01-01", "2026-01-31"),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchPackageReport).toHaveBeenCalledWith({
      report: "SALES",
      from: "2026-01-01",
      to: "2026-01-31",
    })
  })

  it("returns the discriminated union (SALES kind tag)", async () => {
    const payload = {
      kind: "SALES" as const,
      purchaseCount: 3,
      totalRevenue: 500000,
      byBucket: { cash: 100000, network: 0, electronic: 400000 },
      byMethod: [{ method: "CASH", amount: 100000, count: 1 }],
    }
    fetchPackageReport.mockResolvedValueOnce(payload)
    const { result } = renderHook(
      () => usePackageReport("SALES", "2026-01-01", "2026-01-31"),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.kind).toBe("SALES")
  })

  it("returns the discriminated union (REFUNDED kind tag)", async () => {
    const payload = {
      kind: "REFUNDED" as const,
      refundedCount: 1,
      totalRefunded: 50000,
      items: [
        {
          purchaseId: "pp-1",
          packageId: "pkg-1",
          clientId: "cl-1",
          amountPaid: 100000,
          refundAmount: 50000,
          refundedAt: "2026-06-24T00:00:00.000Z",
          notes: null,
        },
      ],
    }
    fetchPackageReport.mockResolvedValueOnce(payload)
    const { result } = renderHook(
      () => usePackageReport("REFUNDED", "2026-06-01", "2026-06-30"),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.data?.kind).toBe("REFUNDED")
  })

  it("forwards a different report type without dropping the discriminator", async () => {
    fetchPackageReport.mockResolvedValueOnce({
      kind: "CONSUMPTION",
      totalConsumed: 5,
      byEmployee: [],
    })
    const { result } = renderHook(
      () => usePackageReport("CONSUMPTION", "2026-01-01", "2026-01-31"),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchPackageReport.mock.calls[0][0].report).toBe("CONSUMPTION")
    expect(result.current.data?.kind).toBe("CONSUMPTION")
  })
})
