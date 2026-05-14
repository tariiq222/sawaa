import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (k: string) => k, locale: "en" }),
}))

vi.mock("@/components/features/breadcrumbs", () => ({
  Breadcrumbs: () => <nav data-testid="breadcrumbs" />,
}))

import { InvoiceListPage } from "@/components/features/invoices/invoice-list-page"

describe("InvoiceListPage", () => {
  it("renders the page header title and description (translation keys)", () => {
    render(<InvoiceListPage />)
    expect(screen.getByText("invoices.title")).toBeTruthy()
    expect(screen.getByText("invoices.description")).toBeTruthy()
  })

  it("renders the empty-state message", () => {
    render(<InvoiceListPage />)
    expect(screen.getByText("invoices.empty.description")).toBeTruthy()
  })

  it("includes Breadcrumbs", () => {
    render(<InvoiceListPage />)
    expect(screen.getByTestId("breadcrumbs")).toBeTruthy()
  })
})
