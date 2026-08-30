import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import React from "react"
import type { Booking } from "@/lib/types/booking"

const collectMutateAsync = vi.fn().mockResolvedValue({})

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}))

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ canDo: () => true }),
}))

vi.mock("@/hooks/use-payments", () => ({
  useRecordPaymentMutations: () => ({
    collectMut: { mutateAsync: collectMutateAsync, isPending: false },
    ensureInvoiceMut: {
      mutateAsync: vi.fn().mockRejectedValue(new Error("no invoice")),
      isPending: false,
      isError: true,
    },
  }),
}))

vi.mock("@/hooks/use-discount-reasons", () => ({
  useDiscountReasons: () => ({
    data: [
      {
        id: "reason-1",
        labelAr: "خصم خاص",
        labelEn: null,
        isActive: true,
        sortOrder: 0,
        createdAt: "",
        updatedAt: "",
      },
    ],
  }),
}))

vi.mock("@/hooks/use-organization-settings", () => ({
  usePaymentSettings: () => ({
    data: {
      paymentMoyasarEnabled: true,
      paymentAtClinicEnabled: true,
      payMethodCashEnabled: true,
      payMethodBankEnabled: false,
      payMethodMadaEnabled: true,
      payMethodTabbyEnabled: false,
    },
  }),
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { RecordPaymentDialog } from "@/components/features/bookings/record-payment-dialog"

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "book-1",
    invoice: {
      id: "inv-1",
      subtotal: 10000,
      vatRate: 0.15,
      total: 11500,
      outstanding: 11500,
      status: "ISSUED",
    },
    payment: null,
    ...overrides,
  } as unknown as Booking
}

function renderDialog(booking: Booking) {
  return render(
    <RecordPaymentDialog booking={booking} open onOpenChange={() => {}} />
  )
}

describe("RecordPaymentDialog", () => {
  beforeEach(() => {
    collectMutateAsync.mockClear()
  })

  it("displays the full payable amount as read-only (115.00 SAR)", () => {
    renderDialog(makeBooking())
    const amount = screen.getByLabelText(
      /recordPayment.amount/
    ) as HTMLInputElement
    expect(amount.value).toBe("115.00")
    expect(amount).toHaveAttribute("readonly")
  })

  it("records a payment without discount via a single collectMut call", async () => {
    renderDialog(makeBooking())
    fireEvent.click(screen.getByText("bookings.recordPayment.submit"))
    await waitFor(() => expect(collectMutateAsync).toHaveBeenCalled())
    expect(collectMutateAsync).toHaveBeenCalledTimes(1)
    expect(collectMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "book-1",
        method: "CASH",
        amount: 11500, // 115 SAR → halalas
        idempotencyKey: expect.any(String),
      })
    )
  })

  it("blocks submission when a discount is entered without a reason", () => {
    renderDialog(makeBooking())
    const discount = screen.getByLabelText("bookings.recordPayment.discount")
    fireEvent.change(discount, { target: { value: "10" } })
    const submit = screen
      .getByText("bookings.recordPayment.submit")
      .closest("button")!
    expect(submit).toBeDisabled()
  })

  it("recalculates the read-only payable amount when a discount is entered", () => {
    renderDialog(makeBooking())
    const amount = screen.getByLabelText(
      /recordPayment.amount/
    ) as HTMLInputElement
    expect(amount.value).toBe("115.00")

    // Enter a 15 SAR discount on the 100 SAR subtotal → VAT recomputed on the
    // reduced base: (100 − 15) × 1.15 = 97.75 SAR payable.
    fireEvent.change(screen.getByLabelText("bookings.recordPayment.discount"), {
      target: { value: "15" },
    })
    expect(amount.value).toBe("97.75")
    expect(amount).toHaveAttribute("readonly")
    // The discount-reason selector appears once a discount is entered.
    expect(
      screen.getByText("bookings.recordPayment.discountReason")
    ).toBeInTheDocument()
  })

  it("submits the exact full post-discount payable in halalas", async () => {
    renderDialog(makeBooking())
    fireEvent.change(screen.getByLabelText("bookings.recordPayment.discount"), {
      target: { value: "15" },
    })
    fireEvent.click(
      screen.getByText("bookings.recordPayment.discountReasonPlaceholder")
    )
    fireEvent.click(screen.getByText("خصم خاص"))
    fireEvent.click(screen.getByText("bookings.recordPayment.submit"))

    await waitFor(() => expect(collectMutateAsync).toHaveBeenCalled())
    expect(collectMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "book-1",
        amount: 9775,
        discountAmt: 1500,
        discountReasonId: "reason-1",
        idempotencyKey: expect.any(String),
      })
    )
  })

  it("renders only the payment methods enabled in settings", () => {
    renderDialog(makeBooking())
    const group = screen.getByRole("radiogroup")
    // Settings mock enables cash + mada, disables bank + tabby.
    expect(group.querySelectorAll('[role="radio"]').length).toBe(2)
    expect(
      screen.getByRole("radio", { name: "bookings.recordPayment.method.cash" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("radio", { name: "bookings.recordPayment.method.mada" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("radio", {
        name: "bookings.recordPayment.method.tabby",
      })
    ).not.toBeInTheDocument()
  })

  it("records the payment with the selected method via a single collectMut call", async () => {
    renderDialog(makeBooking())
    fireEvent.click(
      screen.getByRole("radio", { name: "bookings.recordPayment.method.mada" })
    )
    fireEvent.click(screen.getByText("bookings.recordPayment.submit"))
    await waitFor(() => expect(collectMutateAsync).toHaveBeenCalled())
    expect(collectMutateAsync).toHaveBeenCalledTimes(1)
    expect(collectMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "book-1",
        method: "MADA",
        amount: 11500,
        idempotencyKey: expect.any(String),
      })
    )
    // No standalone discount payload is sent when no discount is entered.
    const call = collectMutateAsync.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >
    expect(call).not.toHaveProperty("discountAmt")
    expect(call).not.toHaveProperty("discountReasonId")
  })

  it("shows no-invoice message when the booking has no invoice", () => {
    renderDialog(makeBooking({ invoice: null }))
    expect(
      screen.getByText("bookings.recordPayment.noInvoice")
    ).toBeInTheDocument()
  })

  it("parses Arabic discount input and omits amount for a full discount", async () => {
    renderDialog(makeBooking())
    fireEvent.change(screen.getByLabelText("bookings.recordPayment.discount"), {
      target: { value: "١٠٠٫٠٠" },
    })
    fireEvent.click(
      screen.getByText("bookings.recordPayment.discountReasonPlaceholder")
    )
    fireEvent.click(screen.getByText("خصم خاص"))
    fireEvent.click(screen.getByText("bookings.recordPayment.submit"))

    await waitFor(() => expect(collectMutateAsync).toHaveBeenCalled())
    expect(collectMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: "book-1",
        discountAmt: 10000,
        discountReasonId: "reason-1",
        idempotencyKey: expect.any(String),
      })
    )
    expect(collectMutateAsync.mock.calls[0]?.[0]).not.toHaveProperty("amount")
  })

  it("keeps the idempotency key across a failed retry", async () => {
    collectMutateAsync
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({})
    renderDialog(makeBooking())
    const submit = screen.getByText("bookings.recordPayment.submit")
    fireEvent.click(submit)
    await waitFor(() => expect(collectMutateAsync).toHaveBeenCalledTimes(1))
    fireEvent.click(submit)
    await waitFor(() => expect(collectMutateAsync).toHaveBeenCalledTimes(2))
    expect(collectMutateAsync.mock.calls[1]?.[0].idempotencyKey).toBe(
      collectMutateAsync.mock.calls[0]?.[0].idempotencyKey
    )
  })
})
