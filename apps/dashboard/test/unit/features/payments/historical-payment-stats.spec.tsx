import React from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key, locale: "ar" }),
}))

import { HistoricalPaymentStats } from "@/components/features/payments/historical-payment-stats"

describe("HistoricalPaymentStats", () => {
  it("labels confirmed and review amounts separately from operational revenue", () => {
    render(<HistoricalPaymentStats stats={{
      collectedCount: 3427,
      collectedAmount: 103353250,
      reviewCount: 109,
      reviewAmount: 1575000,
    }} />)

    expect(screen.getByText("payments.historical.collected")).toBeInTheDocument()
    expect(screen.getByText("payments.historical.review")).toBeInTheDocument()
    expect(screen.getByText("payments.historical.readOnly")).toBeInTheDocument()
    expect(screen.queryByText("payments.stats.total")).not.toBeInTheDocument()
  })
})
