/**
 * booking-column-cells.test.tsx
 *
 * Verifies the permission gating added to the booking column cells:
 *   - PaymentStatusCell renders the "Record payment" button when the user has
 *     `create:Payment` + `create:Invoice` (RECEPTIONIST built-in role) OR
 *     `manage:Payment` + `manage:Invoice` (ADMIN/OWNER/ACCOUNTANT) — see
 *     BK-COLLECT-P0 / canCollectBooking in booking-collect-action.tsx.
 *   - ActionsCell only renders the manual-refund button when the user has
 *     `update:Payment` (backend: PATCH /payments/:id/manual-refund), on top
 *     of the existing payment-state condition.
 */

import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
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

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

const { verifyMutate, startBookingPaymentPolling } = vi.hoisted(() => ({
  verifyMutate: vi.fn(),
  startBookingPaymentPolling: vi.fn(),
}))

vi.mock("@/hooks/use-payments", () => ({
  usePaymentMutations: () => ({ verifyMut: { isPending: false, mutate: verifyMutate } }),
}))

vi.mock("@/hooks/use-booking-payment-polling", () => ({
  useBookingPaymentPolling: () => ({ start: startBookingPaymentPolling, cancel: vi.fn() }),
}))

vi.mock("@/components/features/status-badge", () => ({
  StatusBadge: () => <span>status-badge</span>,
  PaymentStatusBadge: ({ label }: { label: string }) => <span>{label}</span>,
}))

vi.mock("@/components/features/bookings/record-payment-dialog", () => ({
  RecordPaymentDialog: () => null,
}))

vi.mock("@/components/features/bookings/booking-refund-dialog", () => ({
  BookingRefundDialog: () => null,
}))

vi.mock("@sawaa/ui", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { useAuth } from "@/components/providers/auth-provider"
import {
  PaymentStatusCell,
  ActionsCell,
} from "@/components/features/bookings/booking-column-cells"
import { AmountCell } from "@/components/features/bookings/booking-amount-cell"
import type { Booking } from "@/lib/types/booking"

const mockUseAuth = vi.mocked(useAuth)

/** Build a canDo that only grants the given `module:action` permission strings. */
function authWith(...granted: string[]) {
  return {
    canDo: (m: string, a: string) =>
      granted.includes(`${m.toLowerCase()}:${a.toLowerCase()}`),
  } as ReturnType<typeof useAuth>
}

/* ─── Fixtures ─── */

const payableBooking = {
  id: "b1",
  clientId: "c1",
  priceSnapshot: 50000,
  service: { price: 50000 },
  invoice: null,
  payment: null,
} as unknown as Booking

const refundableBooking = {
  id: "b2",
  invoice: { id: "inv2" },
  payment: { id: "pay2", status: "paid", method: "cash", amount: 50000 },
} as unknown as Booking

const packageFundedBooking = {
  id: "b-package",
  clientId: "c1",
  priceSnapshot: 50000,
  service: { price: 50000 },
  invoice: null,
  payment: null,
  packageFunding: {
    creditId: "credit-1",
    purchaseId: "purchase-1",
    packageId: "package-1",
    packageNameAr: "باقة الاستشارات",
    packageNameEn: "Counseling package",
    usageStatus: "CONSUMED",
  },
} as unknown as Booking

beforeEach(() => {
  mockUseAuth.mockReset()
  verifyMutate.mockReset()
  startBookingPaymentPolling.mockReset()
})

/* ─── PaymentStatusCell — create:Payment + create:Invoice gate (BK-COLLECT-P0) ─── */

test("PaymentStatusCell shows record-payment button with create:Payment + create:Invoice (RECEPTIONIST)", () => {
  mockUseAuth.mockReturnValue(authWith("payment:create", "invoice:create"))
  render(<PaymentStatusCell booking={payableBooking} />)
  expect(
    screen.getByRole("button", { name: "bookings.col.recordPayment" }),
  ).toBeInTheDocument()
})

test("PaymentStatusCell still shows record-payment button with manage:Payment + manage:Invoice (ADMIN/OWNER/ACCOUNTANT)", () => {
  // CASL `manage` is a superset of `create`; the predicate accepts either.
  mockUseAuth.mockReturnValue(authWith("payment:manage", "invoice:manage"))
  render(<PaymentStatusCell booking={payableBooking} />)
  expect(
    screen.getByRole("button", { name: "bookings.col.recordPayment" }),
  ).toBeInTheDocument()
})

test("PaymentStatusCell hides record-payment button with no permissions", () => {
  mockUseAuth.mockReturnValue(authWith())
  render(<PaymentStatusCell booking={payableBooking} />)
  expect(
    screen.queryByRole("button", { name: "bookings.col.recordPayment" }),
  ).not.toBeInTheDocument()
})

test("PaymentStatusCell hides record-payment button with only payment:create (no invoice:create)", () => {
  // Ensures BOTH halves of the gate are required — invoice create matters too.
  mockUseAuth.mockReturnValue(authWith("payment:create"))
  render(<PaymentStatusCell booking={payableBooking} />)
  expect(
    screen.queryByRole("button", { name: "bookings.col.recordPayment" }),
  ).not.toBeInTheDocument()
})

test("PaymentStatusCell hides record-payment button with only invoice:create (no payment:create)", () => {
  mockUseAuth.mockReturnValue(authWith("invoice:create"))
  render(<PaymentStatusCell booking={payableBooking} />)
  expect(
    screen.queryByRole("button", { name: "bookings.col.recordPayment" }),
  ).not.toBeInTheDocument()
})

test("PaymentStatusCell shows package funding instead of unpaid or record-payment", () => {
  mockUseAuth.mockReturnValue(authWith("payment:create", "invoice:create"))
  render(<PaymentStatusCell booking={packageFundedBooking} />)

  expect(screen.getByText("bookings.col.paymentStatus.packageFunded")).toBeInTheDocument()
  expect(screen.queryByText("bookings.col.paymentStatus.unpaid")).not.toBeInTheDocument()
  expect(
    screen.queryByRole("button", { name: "bookings.col.recordPayment" }),
  ).not.toBeInTheDocument()
})

test("PaymentStatusCell distinguishes a credit returned to its package", () => {
  mockUseAuth.mockReturnValue(authWith("payment:create", "invoice:create"))
  render(
    <PaymentStatusCell
      booking={{
        ...packageFundedBooking,
        packageFunding: {
          ...packageFundedBooking.packageFunding!,
          usageStatus: "RETURNED",
        },
      }}
    />,
  )

  expect(
    screen.getByText("bookings.col.paymentStatus.packageReturned"),
  ).toBeInTheDocument()
  expect(
    screen.queryByText("bookings.col.paymentStatus.packageFunded"),
  ).not.toBeInTheDocument()
})

/* ─── ActionsCell — update:Payment gate on manual refund ─── */

test("ActionsCell shows manual-refund button with update:Payment", () => {
  mockUseAuth.mockReturnValue(authWith("payment:update"))
  render(<ActionsCell booking={refundableBooking} onView={vi.fn()} onDelete={vi.fn()} t={(k) => k} />)
  expect(screen.getByRole("button", { name: "refund.title" })).toBeInTheDocument()
})

test("ActionsCell hides manual-refund button without update:Payment", () => {
  mockUseAuth.mockReturnValue(authWith())
  render(<ActionsCell booking={refundableBooking} onView={vi.fn()} onDelete={vi.fn()} t={(k) => k} />)
  expect(screen.queryByRole("button", { name: "refund.title" })).not.toBeInTheDocument()
})

/* ─── AmountCell — package-funded session value ─── */

/** Build a minimal Booking fixture, overridable per test. */
function buildBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "b-amount",
    isHistoricalImport: false,
    historicalPayment: null,
    payment: null,
    priceSnapshot: null,
    service: null,
    packageFunding: null,
    ...overrides,
  } as unknown as Booking
}

const funding = {
  creditId: "credit-1",
  purchaseId: "purchase-1",
  packageId: "package-1",
  packageNameAr: "باقة الاستشارات",
  packageNameEn: "Counseling package",
  usageStatus: "CONSUMED" as const,
  sessionValue: null as number | null,
}

test("shows the session value and the package marker for a package booking", () => {
  render(
    <AmountCell
      booking={buildBooking({
        payment: null,
        priceSnapshot: null,
        packageFunding: { ...funding, sessionValue: 29100 },
      })}
    />,
  )

  expect(screen.getByText(/291/)).toBeInTheDocument()
  expect(screen.getByText("bookings.amount.fromPackage")).toBeInTheDocument()
})

test("falls back to the payment total when there is no package funding", () => {
  render(
    <AmountCell
      booking={buildBooking({
        payment: { totalAmount: 50000 } as Booking["payment"],
      })}
    />,
  )

  expect(screen.getByText(/500/)).toBeInTheDocument()
  expect(screen.queryByText("bookings.amount.fromPackage")).not.toBeInTheDocument()
})

test("prefers the package session value over a stray payment total", () => {
  // Package funding is more specific than a payment/priceSnapshot/service
  // fallback — it should win even if one of those happens to be present.
  render(
    <AmountCell
      booking={buildBooking({
        payment: { totalAmount: 99999 } as Booking["payment"],
        packageFunding: { ...funding, sessionValue: 29100 },
      })}
    />,
  )

  expect(screen.getByText(/291/)).toBeInTheDocument()
  expect(screen.queryByText(/999/)).not.toBeInTheDocument()
})

test("shows an em dash when there is no payment, snapshot, or package funding", () => {
  render(<AmountCell booking={buildBooking()} />)
  expect(screen.getByText("—")).toBeInTheDocument()
})

test("ActionsCell starts bounded booking polling after approving a transfer", () => {
  mockUseAuth.mockReturnValue(authWith())
  const booking = {
    ...refundableBooking,
    id: "booking-awaiting",
    clientId: "client-1",
    employeeId: "employee-1",
    payment: { id: "payment-awaiting", status: "awaiting", method: "bank_transfer", amount: 50_000 },
  } as unknown as Booking

  render(<ActionsCell booking={booking} onView={vi.fn()} onDelete={vi.fn()} t={(k) => k} />)
  fireEvent.click(screen.getByRole("button", { name: "bookings.payment.action.approveTransfer" }))

  const mutationOptions = verifyMutate.mock.calls[0]?.[1] as { onSuccess?: () => void }
  mutationOptions.onSuccess?.()

  expect(startBookingPaymentPolling).toHaveBeenCalledWith("booking-awaiting")
})
