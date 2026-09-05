import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi, beforeEach } from "vitest"

import type { Payment } from "@/lib/types/payment"

const { fetchPaymentMock, fetchPaymentsMock, manualRefundPaymentMock, refundPaymentMock, showApiErrorMock } = vi.hoisted(() => ({
  fetchPaymentMock: vi.fn(),
  fetchPaymentsMock: vi.fn(),
  manualRefundPaymentMock: vi.fn(),
  refundPaymentMock: vi.fn(),
  showApiErrorMock: vi.fn(),
}))

vi.mock("@/lib/api/payments", () => ({
  fetchPayment: fetchPaymentMock,
  fetchPayments: fetchPaymentsMock,
  manualRefundPayment: manualRefundPaymentMock,
  refundPayment: refundPaymentMock,
}))

vi.mock("@/lib/mutation-helpers", () => ({ showApiError: showApiErrorMock }))

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => key,
    locale: "ar",
  }),
}))

vi.mock("@/hooks/use-organization-config", () => ({
  useOrganizationConfig: () => ({
    formatDate: (value: string) => value,
  }),
}))

vi.mock("@/components/features/shared/sar-symbol", () => ({
  FormattedCurrency: ({ amount }: { amount: number }) => <span>{amount}</span>,
}))

vi.mock("@/components/features/payments/payment-actions", () => ({
  PaymentActions: ({ onRefund }: { onRefund: () => void }) => (
    <div data-testid="payment-actions">
      <button type="button" onClick={onRefund}>open-refund</button>
    </div>
  ),
}))

vi.mock("@sawaa/ui", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
  Separator: () => <hr />,
  Skeleton: () => <div data-testid="skeleton" />,
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}))

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "pay-target",
    invoiceId: "inv-1",
    amount: 10_000,
    refundedAmount: 0,
    currency: "SAR",
    method: "ONLINE_CARD" as Payment["method"],
    status: "COMPLETED" as Payment["status"],
    gatewayRef: "moy-1",
    idempotencyKey: null,
    receiptUrl: null,
    failureReason: null,
    processedAt: "2026-04-17T10:00:00Z",
    createdAt: "2026-04-17T10:00:00Z",
    updatedAt: "2026-04-17T10:00:00Z",
    ...overrides,
  }
}

function renderDialog(paymentId = "pay-target") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <PaymentDetailDialog
        paymentId={paymentId}
        open
        onOpenChange={() => {}}
        onAction={() => {}}
      />
    </QueryClientProvider>,
  )
}

import { PaymentDetailDialog } from "@/components/features/payments/payment-detail-dialog"

describe("PaymentDetailDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchPaymentMock.mockResolvedValue(makePayment())
    fetchPaymentsMock.mockResolvedValue({
      items: [makePayment({ id: "pay-first" })],
      meta: { total: 1 },
    })
  })

  it("fetches the selected payment through fetchPayment instead of searching the first list page", async () => {
    renderDialog("pay-target")

    await waitFor(() => {
      expect(fetchPaymentMock).toHaveBeenCalledWith("pay-target")
    })
    expect(fetchPaymentsMock).not.toHaveBeenCalled()
  })

  it("shows a retryable error instead of leaving the dialog in loading state", async () => {
    fetchPaymentMock.mockRejectedValueOnce(new Error("network failed"))
    renderDialog()

    expect(await screen.findByRole("alert")).toHaveTextContent("error.server")
    expect(screen.queryByText("common.loading")).not.toBeInTheDocument()
  })

  it("keeps the financial write error visible when an off-gateway refund fails", async () => {
    fetchPaymentMock.mockResolvedValueOnce(makePayment({ method: "CASH", gatewayRef: null }))
    manualRefundPaymentMock.mockRejectedValueOnce(new Error("refund rejected"))
    renderDialog()

    await screen.findByTestId("payment-actions")
    fireEvent.click(screen.getByRole("button", { name: "open-refund" }))
    fireEvent.change(screen.getByRole("textbox", { name: "refund.reasonLabel" }), {
      target: { value: "Correction" },
    })
    fireEvent.click(screen.getByRole("button", { name: "refund.submit" }))

    await waitFor(() => expect(showApiErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: "refund rejected" }),
      expect.objectContaining({ fallback: "refund.errorToast" }),
    ))
    expect(manualRefundPaymentMock).toHaveBeenCalledWith("pay-target", {
      reason: "Correction",
      amount: undefined,
    })
    expect(screen.getByRole("button", { name: "refund.submit" })).toBeInTheDocument()
  })
})
