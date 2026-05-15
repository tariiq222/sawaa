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
    invoiceId: "inv-1",
    amount: 100,
    method: "ONLINE_CARD" as Payment["method"],
    status: "COMPLETED" as Payment["status"],
    gatewayRef: "moy-1",
    idempotencyKey: null,
    failureReason: null,
    refundedAmount: 0,
    createdAt: "2026-04-17T10:00:00Z",
    updatedAt: "2026-04-17T10:00:00Z",
    ...overrides,
  } as Payment
}

describe("PaymentActions", () => {
  it("renders the Refund button only when status is COMPLETED", () => {
    const { rerender } = render(<PaymentActions payment={makePayment({ status: "COMPLETED" as Payment["status"] })} onAction={() => {}} />)
    expect(screen.getByRole("button", { name: /refund/i })).toBeTruthy()
    rerender(<PaymentActions payment={makePayment({ status: "PENDING" as Payment["status"] })} onAction={() => {}} />)
    expect(screen.queryByRole("button", { name: /refund/i })).toBeNull()
  })

  it("hides Verify when method is not BANK_TRANSFER", () => {
    render(<PaymentActions payment={makePayment({ method: "ONLINE_CARD" as Payment["method"] })} onAction={() => {}} />)
    expect(screen.queryByRole("button", { name: /verify transfer/i })).toBeNull()
  })

  it("shows Verify when method is BANK_TRANSFER and has receipts", () => {
    render(
      <PaymentActions
        payment={makePayment({
          method: "BANK_TRANSFER" as Payment["method"],
          status: "PENDING_VERIFICATION" as Payment["status"],
          receipts: [{ id: "r-1" }] as unknown as Payment["receipts"],
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
          method: "BANK_TRANSFER" as Payment["method"],
          status: "PENDING_VERIFICATION" as Payment["status"],
          receipts: [{ id: "r-1" }] as unknown as Payment["receipts"],
        })}
        onAction={() => {}}
      />,
    )
    expect(screen.queryByTestId("verify-dialog")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: /verify transfer/i }))
    expect(screen.getByTestId("verify-dialog")).toBeTruthy()
  })
})
