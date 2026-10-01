import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ locale: "en", t: (key: string) => key }),
}))

vi.mock("@/hooks/use-package-credit-ops", () => ({
  useRefundPackagePurchase: () => ({ mutate: vi.fn(), isPending: false }),
}))

import { SellPackagePricePreview } from "@/components/features/clients/sell-package-price-preview"
import { RefundPackageForm } from "@/components/features/clients/refund-package-form"
import type { SessionPackage } from "@/lib/types/package"
import type { PackagePurchase as ClientPackagePurchase } from "@/lib/types/package-purchase"

const pkg = (vatRate?: number) =>
  ({ subtotal: 40_000, discountAmount: 4_000, finalPrice: 36_000, vatRate }) as unknown as SessionPackage

describe("SellPackagePricePreview VAT", () => {
  it("shows the net total and no VAT row when VAT is 0", () => {
    render(<SellPackagePricePreview pkg={pkg(0)} />)
    expect(screen.queryByText("packages.sell.price.vat")).not.toBeInTheDocument()
    expect(screen.getByText("360.00")).toBeInTheDocument()
  })

  it("adds VAT on top of the net price when VAT is 15%", () => {
    render(<SellPackagePricePreview pkg={pkg(0.15)} />)
    expect(screen.getByText("54.00")).toBeInTheDocument()
    expect(screen.getByText("414.00")).toBeInTheDocument()
  })
})

describe("RefundPackageForm amount charged", () => {
  it("defaults the refund to the VAT-inclusive amount charged", () => {
    const purchase = { id: "p1", amountPaid: 36_000, totalCharged: 41_400, vatAmount: 5_400, refundAmount: 0, credits: [] } as unknown as ClientPackagePurchase
    render(<RefundPackageForm purchase={purchase} onClose={() => {}} />)
    expect(screen.getByDisplayValue("414")).toBeInTheDocument()
  })

  it("falls back to amountPaid when the row has no totalCharged", () => {
    const purchase = { id: "p1", amountPaid: 36_000, refundAmount: 0, credits: [] } as unknown as ClientPackagePurchase
    render(<RefundPackageForm purchase={purchase} onClose={() => {}} />)
    expect(screen.getByDisplayValue("360")).toBeInTheDocument()
  })
})
