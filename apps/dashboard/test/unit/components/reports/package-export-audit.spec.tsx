import type { ReactNode } from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { it, expect, vi } from "vitest"
vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ locale: "en", t: (s: string) => s }),
}))
vi.mock("@/components/features/reports/report-page-shell", () => ({
  ReportPageShell: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}))
vi.mock("@/components/features/reports/pages/packages-report-bodies", () => ({
  PackageReportBody: () => null,
}))
vi.mock("@/components/features/reports/reports-period-context", () => ({
  useReportsPeriodCtx: () => ({
    normalizedFrom: "2026-10-01",
    normalizedTo: "2026-10-10",
    apiDateTo: "2026-10-10T20:59:59.999Z",
  }),
}))
vi.mock("@/hooks/use-package-reports", () => ({
  usePackageReport: () => ({
    data: {
      kind: "SALES",
      purchaseCount: 1,
      grossRevenue: 4950,
      refundedAmount: 0,
      netRevenue: 4950,
      byBucket: { cash: 4950, network: 0, electronic: 0 },
      byMethod: [{ method: "CASH", count: 1, amount: 4950 }],
    },
    isLoading: false,
    error: null,
  }),
}))
import { PackagesReportPage } from "@/components/features/reports/pages/packages-report-page"
it("exports the loaded package report including SAR amounts", () => {
  let csv = ""
  vi.stubGlobal(
    "Blob",
    class {
      constructor(parts: BlobPart[]) {
        csv = parts.join("")
      }
    }
  )
  URL.createObjectURL = vi.fn(() => "blob:csv")
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})
  render(<PackagesReportPage />)
  fireEvent.click(screen.getByRole("button", { name: "reports.packageExport" }))
  expect(csv).toContain("49.50")
  expect(csv).not.toContain("4950")
})
