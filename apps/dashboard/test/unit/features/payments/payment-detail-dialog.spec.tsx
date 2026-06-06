import React from "react"
import { render, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it, vi, beforeEach } from "vitest"

import type { Payment } from "@/lib/types/payment"

const { fetchPaymentMock, fetchPaymentsMock } = vi.hoisted(() => ({
  fetchPaymentMock: vi.fn(),
  fetchPaymentsMock: vi.fn(),
}))

vi.mock("@/lib/api/payments", () => ({
  fetchPayment: fetchPaymentMock,
  fetchPayments: fetchPaymentsMock,
}))

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
  PaymentActions: () => <div data-testid="payment-actions" />,
}))

vi.mock("@sawaa/ui", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  Separator: () => <hr />,
  Skeleton: () => <div data-testid="skeleton" />,
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
})
