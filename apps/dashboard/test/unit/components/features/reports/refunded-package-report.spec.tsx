import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ locale: "en", t: (key: string) => key }),
}))

vi.mock("@/components/features/shared/sar-symbol", () => ({
  FormattedCurrency: ({ amount }: { amount: number }) => <span>{amount}</span>,
}))

import { RefundedPackageReport } from "@/components/features/reports/pages/refunded-package-report"
import type {
  RefundedPackagesEventsReport,
  RefundedPackagesLegacyReport,
} from "@/lib/types/package-report"

const props = { locale: "en" as const, t: (key: string) => key }

describe("RefundedPackageReport", () => {
  it("keeps repeated purchase events separate and renders undated zero aggregates", () => {
    const report: RefundedPackagesEventsReport = {
      kind: "REFUNDED",
      historyMode: "EVENTS",
      historyReconciliation: { complete: true, unresolvedPurchaseCount: 0 },
      eventCount: 2,
      purchaseCount: 1,
      totalRefunded: 30_000,
      items: [
        {
          eventId: "event-1",
          purchaseId: "purchase-1",
          packageId: "package-1",
          clientId: "client-1",
          amountPaid: 100_000,
          refundAmount: 10_000,
          refundType: "PARTIAL",
          source: "LIVE",
          occurredAt: "2026-06-24T00:00:00.000Z",
          notes: null,
        },
        {
          eventId: "event-2",
          purchaseId: "purchase-1",
          packageId: "package-1",
          clientId: "client-1",
          amountPaid: 100_000,
          refundAmount: 20_000,
          refundType: "FULL",
          source: "LIVE",
          occurredAt: "2026-06-25T00:00:00.000Z",
          notes: "final refund",
        },
      ],
      undatedHistorical: {
        recordCount: 1,
        purchaseCount: 1,
        totalRefunded: 0,
        items: [
          {
            eventId: "legacy-zero",
            purchaseId: "legacy-purchase",
            packageId: null,
            clientId: null,
            amountPaid: null,
            refundAmount: 0,
            refundType: "UNKNOWN",
            source: "LEGACY_AGGREGATE",
            occurredAt: null,
            notes: "terminal cancellation evidence",
          },
        ],
      },
    }

    render(<RefundedPackageReport report={report} {...props} />)

    expect(screen.getAllByRole("row")).toHaveLength(5)
    expect(screen.getAllByText("purchase")).toHaveLength(2)
    expect(screen.getByText("reports.packages.refunded.dateUnknown")).toBeInTheDocument()
    expect(screen.getByText("reports.packages.refunded.source.LEGACY_AGGREGATE")).toBeInTheDocument()
    expect(screen.getAllByText("reports.packages.refunded.notAvailable").length).toBeGreaterThan(0)
    expect(screen.getByText("terminal cancellation evidence")).toBeInTheDocument()
  })

  it("keeps an undated zero aggregate visible when there are no dated events", () => {
    const report: RefundedPackagesEventsReport = {
      kind: "REFUNDED",
      historyMode: "EVENTS",
      historyReconciliation: { complete: true, unresolvedPurchaseCount: 0 },
      eventCount: 0,
      purchaseCount: 0,
      totalRefunded: 0,
      items: [],
      undatedHistorical: {
        recordCount: 1,
        purchaseCount: 1,
        totalRefunded: 0,
        items: [
          {
            eventId: "undated-terminal-zero",
            purchaseId: "purchase-terminal-zero",
            packageId: null,
            clientId: null,
            amountPaid: null,
            refundAmount: 0,
            refundType: "UNKNOWN",
            source: "LEGACY_AGGREGATE",
            occurredAt: null,
            notes: "terminal cancellation evidence",
          },
        ],
      },
    }

    render(<RefundedPackageReport report={report} {...props} />)

    expect(screen.queryByTestId("report-empty")).not.toBeInTheDocument()
    expect(screen.getByText("reports.packages.refunded.undatedItems")).toBeInTheDocument()
    expect(screen.getByText("terminal cancellation evidence")).toBeInTheDocument()
    expect(screen.getAllByRole("row")).toHaveLength(2)
  })

  it("shows the incomplete reconciliation warning and preserves legacy totals/table", () => {
    const report: RefundedPackagesLegacyReport = {
      kind: "REFUNDED",
      historyMode: "LEGACY",
      historyReconciliation: { complete: false, unresolvedPurchaseCount: 3 },
      refundedCount: 1,
      totalRefunded: 50_000,
      items: [
        {
          purchaseId: "legacy-purchase",
          packageId: "legacy-package",
          clientId: "legacy-client",
          amountPaid: 100_000,
          refundAmount: 50_000,
          refundedAt: "2026-06-24T00:00:00.000Z",
          notes: null,
        },
      ],
    }

    render(<RefundedPackageReport report={report} {...props} />)

    expect(screen.getByRole("alert")).toHaveTextContent(
      "reports.packages.refunded.historyIncomplete",
    )
    expect(screen.getAllByRole("row")).toHaveLength(2)
    expect(screen.getByText("legacy-p")).toBeInTheDocument()
  })
})
