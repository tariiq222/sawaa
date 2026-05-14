import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/features/payments/refund-dialog", () => ({
  RefundDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="refund-dialog" /> : null),
}))

vi.mock("@/components/features/payments/verify-dialog", () => ({
  VerifyDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="verify-dialog" /> : null),
}))

import { PaymentActions } from "@/components/features/payments/payment-actions"
import type { Payment } from "@/lib/types/payment"

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "pay-1",
    bookingId: "bk-1",
    amount: 100,
    vatAmount: 15,
    totalAmount: 115,
    method: "moyasar" as Payment["method"],
    status: "paid" as Payment["status"],
    moyasarPaymentId: "moy-1",
    transactionRef: null,
    createdAt: "2026-04-17T10:00:00Z",
    updatedAt: "2026-04-17T10:00:00Z",
    ...overrides,
  } as Payment
}

describe("PaymentActions", () => {
  it("renders the Refund button only when status is paid", () => {
    const { rerender } = render(<PaymentActions payment={makePayment({ status: "paid" as Payment["status"] })} onAction={() => {}} />)
    expect(screen.getByRole("button", { name: /refund/i })).toBeTruthy()
    rerender(<PaymentActions payment={makePayment({ status: "pending" as Payment["status"] })} onAction={() => {}} />)
    expect(screen.queryByRole("button", { name: /refund/i })).toBeNull()
  })

  it("hides Verify when method is not bank_transfer", () => {
    render(<PaymentActions payment={makePayment({ method: "moyasar" as Payment["method"] })} onAction={() => {}} />)
    expect(screen.queryByRole("button", { name: /verify transfer/i })).toBeNull()
  })

  it("hides Verify when bank transfer has no receipts", () => {
    render(
      <PaymentActions
        payment={makePayment({ method: "bank_transfer" as Payment["method"], receipts: [] })}
        onAction={() => {}}
      />,
    )
    expect(screen.queryByRole("button", { name: /verify transfer/i })).toBeNull()
  })

  it("shows Verify when bank_transfer has at least one receipt", () => {
    render(
      <PaymentActions
        payment={makePayment({
          method: "bank_transfer" as Payment["method"],
          receipts: [{ id: "r-1" } as Payment["receipts"] extends readonly (infer T)[] | undefined ? T : never],
        })}
        onAction={() => {}}
      />,
    )
    expect(screen.getByRole("button", { name: /verify transfer/i })).toBeTruthy()
  })

  it("opens the refund dialog when Refund is clicked", () => {
    render(<PaymentActions payment={makePayment()} onAction={() => {}} />)
    expect(screen.queryByTestId("refund-dialog")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /refund/i }))
    expect(screen.getByTestId("refund-dialog")).toBeTruthy()
  })

  it("opens the verify dialog when Verify Transfer is clicked", () => {
    render(
      <PaymentActions
        payment={makePayment({
          method: "bank_transfer" as Payment["method"],
          receipts: [{ id: "r-1" } as never],
        })}
        onAction={() => {}}
      />,
    )
    expect(screen.queryByTestId("verify-dialog")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /verify transfer/i }))
    expect(screen.getByTestId("verify-dialog")).toBeTruthy()
  })
})
