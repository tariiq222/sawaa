/**
 * booking-column-cells.test.tsx
 *
 * Verifies the permission gating added to the booking column cells:
 *   - PaymentStatusCell only renders the "Record payment" button when the
 *     user has `manage:Payment` (backend: POST /dashboard/finance/payments).
 *   - ActionsCell only renders the manual-refund button when the user has
 *     `update:Payment` (backend: PATCH /payments/:id/manual-refund), on top
 *     of the existing payment-state condition.
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

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

vi.mock("@/hooks/use-payments", () => ({
  usePaymentMutations: () => ({ verifyMut: { isPending: false, mutate: vi.fn() } }),
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

beforeEach(() => {
  mockUseAuth.mockReset()
})

/* ─── PaymentStatusCell — manage:Payment gate ─── */

test("PaymentStatusCell shows record-payment button with manage:Payment", () => {
  mockUseAuth.mockReturnValue(authWith("payment:manage"))
  render(<PaymentStatusCell booking={payableBooking} />)
  expect(
    screen.getByRole("button", { name: "bookings.col.recordPayment" }),
  ).toBeInTheDocument()
})

test("PaymentStatusCell hides record-payment button without manage:Payment", () => {
  mockUseAuth.mockReturnValue(authWith())
  render(<PaymentStatusCell booking={payableBooking} />)
  expect(
    screen.queryByRole("button", { name: "bookings.col.recordPayment" }),
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
