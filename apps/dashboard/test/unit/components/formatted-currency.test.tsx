import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/money", () => ({
  formatPrice: (n: number) => `${(n / 100).toFixed(2)}`,
}))

import { SarSymbol, FormattedCurrency } from "@/components/features/shared/sar-symbol"

describe("SarSymbol", () => {
  it("renders rial symbol", () => {
    const { container } = render(<SarSymbol />)
    expect(container.textContent).toContain("⃁")
  })

  it("accepts className prop", () => {
    const { container } = render(<SarSymbol className="text-primary" />)
    expect(container.querySelector(".text-primary")).toBeTruthy()
  })
})

describe("FormattedCurrency", () => {
  it("renders amount and currency symbol", () => {
    const { container } = render(
      <FormattedCurrency amount={12500} locale="ar" />,
    )
    expect(container.textContent).toContain("125.00")
    expect(container.textContent).toContain("⃁")
  })

  it("renders with en locale and 2 decimals", () => {
    const { container } = render(
      <FormattedCurrency amount={12550} locale="en" decimals={2} />,
    )
    expect(container.textContent).toContain("125.50")
  })

  it("renders with ar locale", () => {
    const { container } = render(
      <FormattedCurrency amount={1000} locale="ar" />,
    )
    expect(container.textContent).toContain("⃁")
  })

  it("accepts className", () => {
    const { container } = render(
      <FormattedCurrency amount={500} locale="en" className="text-success" />,
    )
    expect(container.querySelector(".text-success")).toBeTruthy()
  })
})
