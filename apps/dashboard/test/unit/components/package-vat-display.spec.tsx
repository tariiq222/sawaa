import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ locale: "en", t: (key: string) => key }),
}))

vi.mock("@/hooks/use-package-credit-ops", () => ({
  useRefundPackagePurchase: () => ({ mutate: vi.fn(), isPending: false }),
}))

import { SellPackagePricePreview } from "@/components/features/clients/sell-package-price-preview"
import { RefundPackageForm } from "@/components/features/clients/refund-package-form"
import { PurchaseCard } from "@/components/features/clients/client-package-balance-cards"
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

describe("SellPackagePricePreview VAT rounding", () => {
  it("rounds an exact half up like the backend (5000 × 0.03% → 2 halalas)", () => {
    const p = { subtotal: 5_000, discountAmount: 0, finalPrice: 5_000, vatRate: 0.0003 } as unknown as SessionPackage
    render(<SellPackagePricePreview pkg={p} />)
    expect(screen.getByText("0.02")).toBeInTheDocument()
    expect(screen.getByText("50.02")).toBeInTheDocument()
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

describe("RefundPackageForm after a partial refund", () => {
  it("defaults to and caps at what is still refundable", () => {
    const purchase = { id: "p1", amountPaid: 36_000, totalCharged: 41_400, vatAmount: 5_400, refundAmount: 36_000, credits: [] } as unknown as ClientPackagePurchase
    render(<RefundPackageForm purchase={purchase} onClose={() => {}} />)
    expect(screen.getByDisplayValue("54")).toBeInTheDocument()
  })
})

describe("RefundPackageForm partial vs full", () => {
  const purchase = { id: "p1", amountPaid: 36_000, totalCharged: 41_400, vatAmount: 5_400, refundAmount: 0, credits: [], status: "ACTIVE" } as unknown as ClientPackagePurchase

  it("warns that credits are voided for a full refund", () => {
    render(<RefundPackageForm purchase={purchase} onClose={() => {}} />)
    expect(screen.getByText("packages.balances.refund.warning")).toBeInTheDocument()
    expect(screen.queryByText("packages.balances.refund.partialNote")).not.toBeInTheDocument()
  })

  it("explains that credits stay usable for a partial refund", async () => {
    render(<RefundPackageForm purchase={purchase} onClose={() => {}} />)
    const input = screen.getByDisplayValue("414")
    await userEvent.clear(input)
    await userEvent.type(input, "360")
    expect(screen.getByText("packages.balances.refund.partialNote")).toBeInTheDocument()
    expect(screen.queryByText("packages.balances.refund.warning")).not.toBeInTheDocument()
  })
})

describe("PurchaseCard refunded amount", () => {
  it("shows a partial refund on a still-active purchase", () => {
    const purchase = {
      id: "p1", packageNameAr: "باقة", packageNameEn: "Pack", status: "ACTIVE", paidAt: "2026-10-02",
      amountPaid: 36_000, totalCharged: 41_400, refundAmount: 36_000, credits: [],
    } as unknown as ClientPackagePurchase
    render(
      <PurchaseCard purchase={purchase} locale="en" t={(k) => k} formatDate={(d) => d}
        canTransferCredit={false} canRefundPurchase={false}
        onBookCredit={() => {}} onTransferCredit={() => {}} onRefundPurchase={() => {}} />,
    )
    expect(screen.getByText(/packages\.balances\.refundAmount/)).toBeInTheDocument()
  })
})
