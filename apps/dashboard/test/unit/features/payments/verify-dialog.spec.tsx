import React, { useState } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { Payment } from "@/lib/types/payment"

const { fetchBooking, verifyPayment } = vi.hoisted(() => ({
  fetchBooking: vi.fn(),
  verifyPayment: vi.fn(),
}))

vi.mock("@/lib/api/bookings", () => ({ fetchBooking }))
vi.mock("@/lib/api/payments", () => ({ verifyPayment }))
vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key, locale: "ar" }),
}))
vi.mock("@/lib/mutation-helpers", () => ({ showApiError: vi.fn() }))
vi.mock("@sawaa/ui", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
  Select: ({ onValueChange }: { onValueChange: (value: string) => void }) => (
    <button type="button" onClick={() => onValueChange("approve")}>choose approve</button>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
}))

import { VerifyDialog } from "@/components/features/payments/verify-dialog"
import {
  BOOKING_PAYMENT_POLL_INTERVAL_MS,
  BookingPaymentPollingProvider,
} from "@/hooks/use-booking-payment-polling"

function payment(): Payment {
  return {
    id: "payment-1",
    invoiceId: "invoice-1",
    amount: 12_500,
    refundedAmount: 0,
    currency: "SAR",
    method: "BANK_TRANSFER",
    status: "PENDING_VERIFICATION",
    gatewayRef: null,
    idempotencyKey: null,
    receiptUrl: null,
    failureReason: null,
    processedAt: null,
    createdAt: "2026-09-05T10:00:00Z",
    updatedAt: "2026-09-05T10:00:00Z",
    invoice: {
      id: "invoice-1",
      total: 12_500,
      bookingId: "booking-1",
      clientId: "client-1",
    },
  } as Payment
}

describe("VerifyDialog booking synchronization", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.clearAllMocks()
    verifyPayment.mockResolvedValue({ id: "payment-1", invoiceId: "invoice-1", status: "COMPLETED" })
    fetchBooking.mockResolvedValue({ id: "booking-1", status: "confirmed" })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("keeps polling under the payment-page owner after approval closes the dialog", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    function PaymentPageOwner() {
      const [open, setOpen] = useState(true)
      return (
        <QueryClientProvider client={client}>
          <BookingPaymentPollingProvider>
            <VerifyDialog
              paymentId="payment-1"
              payment={payment()}
              open={open}
              onOpenChange={setOpen}
              onSuccess={() => {}}
            />
          </BookingPaymentPollingProvider>
        </QueryClientProvider>
      )
    }

    render(<PaymentPageOwner />)
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "choose approve" }))
    })
    fireEvent.click(screen.getByRole("button", { name: "payments.verify.confirm" }))

    await waitFor(() => expect(verifyPayment).toHaveBeenCalledWith("payment-1", {
      action: "approve",
      transferRef: undefined,
    }))
    expect(screen.queryByRole("heading", { name: "payments.verify.title" })).not.toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOOKING_PAYMENT_POLL_INTERVAL_MS)
    })
    expect(fetchBooking).toHaveBeenCalledWith("booking-1")
  })
})
