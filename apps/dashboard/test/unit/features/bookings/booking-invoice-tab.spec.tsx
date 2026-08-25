/**
 * booking-invoice-tab.spec.tsx
 *
 * Verifies the collect-action gate on the booking invoice tab. The button
 * must surface whenever the booking still owes money — invoice with an
 * outstanding balance, OR a payable booking with no invoice yet — and only
 * when the user has `manage:Payment`. Historical imports stay read-only.
 * Bank transfers under verification (payment.status === "awaiting") never
 * offer a second collection: the invoice still shows the full outstanding
 * because ProcessPaymentHandler only sums COMPLETED payments, so a second
 * collect here would create a duplicate COMPLETED payment.
 */

import React from "react"
import { render, screen } from "@testing-library/react"
import { vi, test, expect, beforeEach } from "vitest"

/* ─── Locale stub — t() echoes the key so we can match on it ─── */

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (k: string) => k, locale: "ar" }),
}))

/* ─── Auth stub — factory so each test injects its own permission set ─── */

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: vi.fn(),
}))

/* ─── Collaborators we don't exercise here ─── */

vi.mock("@/components/features/bookings/record-payment-dialog", () => ({
  RecordPaymentDialog: () => null,
}))

import { useAuth } from "@/components/providers/auth-provider"
import { BookingInvoiceTab } from "@/components/features/bookings/booking-invoice-tab"
import type { Booking } from "@/lib/types/booking"

const mockUseAuth = vi.mocked(useAuth)

/** Build a canDo that only grants the given `module:action` permission strings. */
function authWith(...granted: string[]) {
  return {
    canDo: (m: string, a: string) =>
      granted.includes(`${m.toLowerCase()}:${a.toLowerCase()}`),
  } as ReturnType<typeof useAuth>
}

const COLLECT = "bookings.col.recordPayment"

beforeEach(() => {
  mockUseAuth.mockReset()
})

/* ─── Fixtures ─── */

function withInvoice(outstanding: number): Booking {
  return {
    id: "b1",
    clientId: "c1",
    isHistoricalImport: false,
    invoice: { id: "inv1", subtotal: 10000, vatRate: 0.15, total: 11500, outstanding, status: "ISSUED" },
    payment: null,
  } as unknown as Booking
}

function noInvoiceBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "b1",
    clientId: "c1",
    isHistoricalImport: false,
    priceSnapshot: 50000,
    service: { price: 50000 },
    invoice: null,
    payment: null,
    ...overrides,
  } as unknown as Booking
}

const t = (k: string) => k

/* ─── Invoice with outstanding > 0 + manage:Payment ─── */

test("renders the collect button when the invoice has outstanding and user has manage:Payment", () => {
  mockUseAuth.mockReturnValue(authWith("payment:manage"))
  render(<BookingInvoiceTab booking={withInvoice(11500)} t={t} locale="ar" />)
  expect(screen.getByRole("button", { name: COLLECT })).toBeInTheDocument()
})

/* ─── Invoice fully paid — no collect button ─── */

test("does not render the collect button when the invoice is fully paid (outstanding 0)", () => {
  mockUseAuth.mockReturnValue(authWith("payment:manage"))
  render(<BookingInvoiceTab booking={withInvoice(0)} t={t} locale="ar" />)
  expect(screen.queryByRole("button", { name: COLLECT })).not.toBeInTheDocument()
})

/* ─── No invoice + payable booking + permission ─── */

test("renders the collect button when there is no invoice but the booking is payable", () => {
  mockUseAuth.mockReturnValue(authWith("payment:manage"))
  render(<BookingInvoiceTab booking={noInvoiceBooking()} t={t} locale="ar" />)
  expect(screen.getByRole("button", { name: COLLECT })).toBeInTheDocument()
})

test("does not render the collect button when there is no invoice and no price", () => {
  mockUseAuth.mockReturnValue(authWith("payment:manage"))
  // package-credit path: no priceSnapshot, no service price, no clientId.
  render(
    <BookingInvoiceTab
      booking={noInvoiceBooking({ priceSnapshot: null, service: { price: 0 } as never, clientId: null })}
      t={t}
      locale="ar"
    />,
  )
  expect(screen.queryByRole("button", { name: COLLECT })).not.toBeInTheDocument()
})

/* ─── Historical import never offers collection ─── */

test("never renders the collect button for a historical import with an invoice", () => {
  mockUseAuth.mockReturnValue(authWith("payment:manage"))
  render(
    <BookingInvoiceTab
      booking={{ ...withInvoice(11500), isHistoricalImport: true }}
      t={t}
      locale="ar"
    />,
  )
  expect(screen.queryByRole("button", { name: COLLECT })).not.toBeInTheDocument()
})

test("never renders the collect button for a historical import without an invoice", () => {
  mockUseAuth.mockReturnValue(authWith("payment:manage"))
  render(
    <BookingInvoiceTab
      booking={{ ...noInvoiceBooking(), isHistoricalImport: true }}
      t={t}
      locale="ar"
    />,
  )
  expect(screen.queryByRole("button", { name: COLLECT })).not.toBeInTheDocument()
})

/* ─── Bank transfer under verification — never offer a second collection ─── */

test("does not render the collect button when payment.status is 'awaiting' even with outstanding > 0 and manage:Payment", () => {
  mockUseAuth.mockReturnValue(authWith("payment:manage"))
  // Payment row arrived as a bank-transfer receipt and is sitting in
  // PENDING_VERIFICATION (UI: "awaiting") — invoice still shows full
  // outstanding because the handler ignores non-COMPLETED payments when
  // summing receipts. The tab must not offer a second collection here.
  const booking: Booking = {
    ...withInvoice(11500),
    payment: {
      id: "p1",
      status: "awaiting",
      amount: 11500,
      method: "bank_transfer",
      totalAmount: 11500,
    },
  }
  render(<BookingInvoiceTab booking={booking} t={t} locale="ar" />)
  expect(screen.queryByRole("button", { name: COLLECT })).not.toBeInTheDocument()
  // Read-only summary still renders so staff can review the outstanding.
  expect(screen.getByText("detail.invoice.outstanding")).toBeInTheDocument()
})

/* ─── Missing manage:Payment ─── */

test("does not render the collect button without manage:Payment", () => {
  mockUseAuth.mockReturnValue(authWith())
  render(<BookingInvoiceTab booking={withInvoice(11500)} t={t} locale="ar" />)
  expect(screen.queryByRole("button", { name: COLLECT })).not.toBeInTheDocument()
})

test("does not render the collect button without manage:Payment on a payable booking with no invoice", () => {
  mockUseAuth.mockReturnValue(authWith())
  render(<BookingInvoiceTab booking={noInvoiceBooking()} t={t} locale="ar" />)
  expect(screen.queryByRole("button", { name: COLLECT })).not.toBeInTheDocument()
})

/* ─── Read-only summary stays untouched when invoice exists ─── */

test("renders the invoice summary rows when an invoice is present", () => {
  mockUseAuth.mockReturnValue(authWith("payment:manage"))
  render(<BookingInvoiceTab booking={withInvoice(11500)} t={t} locale="ar" />)
  expect(screen.getByText("detail.invoice.subtotal")).toBeInTheDocument()
  expect(screen.getByText("detail.invoice.total")).toBeInTheDocument()
  expect(screen.getByText("detail.invoice.outstanding")).toBeInTheDocument()
})

/* ─── Empty-state message keeps the existing key ─── */

test("shows the existing detail.invoice.empty message when there is no invoice", () => {
  mockUseAuth.mockReturnValue(authWith())
  render(<BookingInvoiceTab booking={noInvoiceBooking()} t={t} locale="ar" />)
  expect(screen.getByText("detail.invoice.empty")).toBeInTheDocument()
})