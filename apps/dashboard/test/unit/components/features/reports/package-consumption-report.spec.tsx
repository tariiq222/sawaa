import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ locale: "en", t: (key: string) => key }),
}))
import { PackageReportBody } from "@/components/features/reports/pages/packages-report-bodies"

describe("package consumption attribution", () => {
  it("distinguishes uncertain history from booking-backed practitioner records", () => {
    render(<PackageReportBody report={{ kind: "CONSUMPTION", totalConsumed: 4, byEmployee: [
      { employeeId: "confirmed", name: "Historical practitioner", count: 1 },
      { employeeId: "legacy", name: "Current credit practitioner", count: 1, attribution: "LEGACY_CREDIT" },
      { employeeId: "mixed", name: "Mixed history", count: 1, attribution: "MIXED" },
      { employeeId: "unknown", name: "Unknown practitioner", count: 1, attribution: "UNKNOWN" },
    ] }} />)
    expect(screen.getByText("Historical practitioner")).toBeInTheDocument()
    for (const source of ["LEGACY_CREDIT", "MIXED", "UNKNOWN"]) {
      expect(screen.getByText(`reports.packages.consumption.attribution.${source}`)).toBeInTheDocument()
    }
    expect(screen.getByText("reports.packages.consumption.unknownPractitioner")).toBeInTheDocument()
    expect(screen.queryByText("Unknown practitioner")).not.toBeInTheDocument()
  })
})
