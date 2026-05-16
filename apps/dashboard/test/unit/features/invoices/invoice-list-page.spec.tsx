import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (k: string) => k, locale: "en" }),
}))

vi.mock("@/components/features/breadcrumbs", () => ({
  Breadcrumbs: () => <nav data-testid="breadcrumbs" />,
}))

vi.mock("@/hooks/use-invoices", () => ({
  useInvoices: () => ({
    payments: [],
    isLoading: false,
    error: null,
    search: "",
    setSearch: vi.fn(),
  }),
}))

import { InvoiceListPage } from "@/components/features/invoices/invoice-list-page"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  Wrapper.displayName = "TestQueryWrapper"
  return Wrapper
}

describe("InvoiceListPage", () => {
  it("renders the page header title and description (translation keys)", () => {
    const Wrapper = makeWrapper()
    render(<Wrapper><InvoiceListPage /></Wrapper>)
    expect(screen.getByText("invoices.title")).toBeTruthy()
    expect(screen.getByText("invoices.description")).toBeTruthy()
  })

  it("includes Breadcrumbs", () => {
    const Wrapper = makeWrapper()
    render(<Wrapper><InvoiceListPage /></Wrapper>)
    expect(screen.getByTestId("breadcrumbs")).toBeTruthy()
  })
})
