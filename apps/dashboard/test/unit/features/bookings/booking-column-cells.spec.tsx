/**
 * booking-column-cells.spec.tsx
 *
 * StatusCell one-click check-in control (reception UI fix).
 *
 * Confirmed bookings that haven't been checked in yet surface a dedicated
 * "تسجيل حضور" button next to the status badge — reception kept marking
 * confirmed rows as لم يحضر because the action was buried inside the
 * dropdown menu. The button only appears when:
 *   - booking.status === "confirmed"
 *   - booking.checkedInAt is null
 *   - booking.isHistoricalImport is false (preserves the existing early-return)
 *
 * Click invokes the same onStatusAction(booking, "checkin") used by the
 * dropdown so the parent (BookingsTabContent) handles the mutation exactly
 * as before.
 */

import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { vi, test, expect } from "vitest"
import type { Booking } from "@/lib/types/booking"

/* ─── Locale stub — t() echoes the key so we can match on it ─── */

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (k: string) => k, locale: "ar" }),
}))

/* ─── Hugeicons stubs — icons are referenced but never rendered in tests ─── */

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span data-testid="icon" />,
}))

vi.mock("@hugeicons/core-free-icons", () => ({
  Tick01Icon: () => null,
  ViewIcon: () => null,
  Delete02Icon: () => null,
  CheckmarkCircle02Icon: () => null,
  CheckmarkCircle01Icon: () => null,
  CancelCircleIcon: () => null,
  Cancel01Icon: () => null,
  UserCheck01Icon: () => null,
  EyeIcon: () => null,
  Invoice01Icon: () => null,
  Calendar03Icon: () => null,
  ArrowTurnBackwardIcon: () => null,
}))

/* ─── @sawaa/ui dropdown stub — children pass-through, onSelect → onClick ─── */

vi.mock("@sawaa/ui", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onSelect,
  }: {
    children: React.ReactNode
    onSelect?: () => void
  }) => (
    <div data-testid="dropdown-item" onClick={() => onSelect?.()}>
      {children}
    </div>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

/* ─── Status badge stub — neutral text so it doesn't leak into queries ─── */

vi.mock("@/components/features/status-badge", () => ({
  StatusBadge: () => <span>status-badge</span>,
  PaymentStatusBadge: ({ label }: { label?: string }) => <span>{label ?? "payment-badge"}</span>,
}))

import { StatusCell } from "@/components/features/bookings/booking-column-cells"

const CHECKIN_LABEL = "bookings.actions.action.checkin"

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "bk-1",
    status: "confirmed",
    isHistoricalImport: false,
    checkedInAt: null,
    ...overrides,
  } as Booking
}

/* ─── Visible check-in button ─────────────────────────────────────────────── */

test("confirmed without checkedInAt shows the check-in button", () => {
  render(
    <StatusCell
      booking={makeBooking({ status: "confirmed", checkedInAt: null })}
      onStatusAction={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(screen.getByRole("button", { name: CHECKIN_LABEL })).toBeInTheDocument()
})

test("clicking the check-in button calls onStatusAction with 'checkin'", () => {
  const onStatusAction = vi.fn()
  const booking = makeBooking({ status: "confirmed", checkedInAt: null })
  render(
    <StatusCell
      booking={booking}
      onStatusAction={onStatusAction}
      onDelete={vi.fn()}
    />,
  )
  fireEvent.click(screen.getByRole("button", { name: CHECKIN_LABEL }))
  expect(onStatusAction).toHaveBeenCalledTimes(1)
  expect(onStatusAction).toHaveBeenCalledWith(booking, "checkin")
})

/* ─── Hidden cases ────────────────────────────────────────────────────────── */

test("confirmed with checkedInAt does not show the extra check-in button", () => {
  render(
    <StatusCell
      booking={makeBooking({
        status: "confirmed",
        checkedInAt: "2026-08-27T10:00:00.000Z",
      })}
      onStatusAction={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(screen.queryByRole("button", { name: CHECKIN_LABEL })).not.toBeInTheDocument()
})

test("no_show status does not show the extra check-in button", () => {
  render(
    <StatusCell
      booking={makeBooking({ status: "no_show", checkedInAt: null })}
      onStatusAction={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(screen.queryByRole("button", { name: CHECKIN_LABEL })).not.toBeInTheDocument()
})

test("completed status does not show the extra check-in button", () => {
  render(
    <StatusCell
      booking={makeBooking({ status: "completed", checkedInAt: null })}
      onStatusAction={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(screen.queryByRole("button", { name: CHECKIN_LABEL })).not.toBeInTheDocument()
})

test("pending status does not show the extra check-in button", () => {
  render(
    <StatusCell
      booking={makeBooking({ status: "pending", checkedInAt: null })}
      onStatusAction={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
  expect(screen.queryByRole("button", { name: CHECKIN_LABEL })).not.toBeInTheDocument()
})
