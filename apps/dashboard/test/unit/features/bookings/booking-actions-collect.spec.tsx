/**
 * booking-actions-collect.spec.tsx
 *
 * Tests for BookingActions's collect (RecordPaymentDialog) entry — gating,
 * post-complete auto-open behavior, and the fix that a FAILED complete no
 * longer opens the collect dialog. Extracted from booking-actions.spec.tsx
 * to keep it ≤350 lines.
 *
 * Mirrors the canCollect predicate in booking-collect-action.tsx and the
 * PaymentStatusCell gating in booking-column-cells.tsx.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import React from "react"
import type { Booking } from "@/lib/types/booking"

const {
  useBookingMutations,
} = vi.hoisted(() => ({
  useBookingMutations: vi.fn(),
}))

const { useLocale } = vi.hoisted(() => ({
  useLocale: vi.fn(() => ({
    t: (k: string) => k,
    locale: "ar",
  })),
}))

const { useAuth } = vi.hoisted(() => ({
  useAuth: vi.fn(),
}))

vi.mock("@/hooks/use-bookings", () => ({ useBookingMutations }))
vi.mock("@/components/locale-provider", () => ({ useLocale }))
vi.mock("@/components/providers/auth-provider", () => ({ useAuth }))

vi.mock("@/components/features/bookings/record-payment-dialog", () => ({
  RecordPaymentDialog: ({ open, booking }: { open: boolean; booking: Booking }) =>
    open ? <div data-testid="record-payment-dialog" data-booking-id={booking.id} /> : null,
}))

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span data-testid="icon" />,
}))

vi.mock("@hugeicons/core-free-icons", () => ({
  Settings02Icon: () => null,
  Tick01Icon: () => null,
  UserCheck01Icon: () => null,
  ComputerVideoCallIcon: () => null,
  Cancel01Icon: () => null,
  CheckmarkCircle01Icon: () => null,
  EyeIcon: () => null,
  Payment01Icon: () => null,
  ArrowTurnBackwardIcon: () => null,
}))

vi.mock("@sawaa/ui", () => {
  return {
    Button: ({ children, disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button data-testid="btn" disabled={disabled} {...props}>{children}</button>
    ),
    DropdownMenu: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown">{children}</div>,
    DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-trigger">{children}</div>,
    DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-content">{children}</div>,
    DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-label">{children}</div>,
    DropdownMenuSeparator: () => <hr data-testid="dropdown-sep" />,
    DropdownMenuItem: ({ children, onClick, className }: React.HTMLAttributes<HTMLDivElement>) => (
      <div data-testid="dropdown-item" onClick={onClick} className={className}>{children}</div>
    ),
    // Cancel dialogs use Dialog primitives — BookingActions renders all of
    // them conditionally, so this spec must stub them even though these tests
    // only exercise the collect path.
    Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
      open ? <div data-testid="sheet">{children}</div> : null,
    DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet-content">{children}</div>,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet-header">{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet-title">{children}</div>,
    DialogDescription: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet-desc">{children}</div>,
    DialogBody: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet-body">{children}</div>,
    DialogFooter: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet-footer">{children}</div>,
    Select: ({ children, onValueChange }: { children: React.ReactNode; onValueChange?: (v: string) => void }) => (
      <div data-testid="select" onClick={() => onValueChange?.("partial")}>{children}</div>
    ),
    SelectContent: ({ children }: { children: React.ReactNode }) => <div data-testid="select-content">{children}</div>,
    SelectItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
      <div data-testid="select-item" onClick={onClick}>{children}</div>
    ),
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="select-trigger">{children}</div>,
    SelectValue: () => null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Input: (props: any) => React.createElement("input", props),
    Label: ({ children }: { children: React.ReactNode }) => React.createElement("label", {}, children),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Textarea: (props: any) => React.createElement("textarea", props),
  }
})

import { BookingActions } from "@/components/features/bookings/booking-actions"
import { ApiError } from "@/lib/api"

const makeBooking = (status: Booking["status"], overrides: Partial<Booking> = {}): Booking =>
  ({
    id: "bk-1",
    status,
    clientId: "cli-1",
    clientName: "Sara",
    serviceId: "svc-1",
    employeeId: "emp-1",
    date: "2026-06-01",
    startTime: "09:00",
    type: "in_person",
    suggestedRefundType: null,
    ...overrides,
  } as Booking)

function mockMutations(overrides: Record<string, { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean } | object> = {}) {
  const empty = { mutateAsync: vi.fn(), isPending: false }
  const all = {
    confirmMut: { ...empty, ...(overrides.confirmMut as object) },
    checkInMut: { ...empty, ...(overrides.checkInMut as object) },
    completeMut: { ...empty, ...(overrides.completeMut as object) },
    noShowMut: { ...empty, ...(overrides.noShowMut as object) },
    restoreNoShowMut: { ...empty, ...(overrides.restoreNoShowMut as object) },
    adminCancelMut: { ...empty, ...(overrides.adminCancelMut as object) },
    approveCancelMut: { ...empty, ...(overrides.approveCancelMut as object) },
    rejectCancelMut: { ...empty, ...(overrides.rejectCancelMut as object) },
  }
  useBookingMutations.mockReturnValue(all)
  return all
}

function mockAuth(
  canDo: (module: string, action: string) => boolean = () => true,
) {
  useAuth.mockReturnValue({ canDo })
}

function findDropdownItem(text: string) {
  const items = screen.getByTestId("dropdown-content").querySelectorAll("[data-testid='dropdown-item']")
  return Array.from(items).find((el) => el.textContent?.includes(text))
}

describe("BookingActions – Collect entry", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockAuth()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const invoiceWithOutstanding = {
    id: "inv-1",
    outstanding: 50000, // 500 SAR in halalas
    subtotal: 50000,
    vatRate: 0.15,
    total: 57500,
    status: "ISSUED",
  }
  const awaitingPayment = {
    id: "pay-1",
    amount: 50000,
    method: "bank_transfer" as const,
    status: "awaiting" as const,
    totalAmount: 50000,
  }

  it("appears for a confirmed booking with an outstanding invoice", () => {
    mockMutations()
    render(
      <BookingActions
        booking={makeBooking("confirmed", { invoice: invoiceWithOutstanding })}
        onAction={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    expect(findDropdownItem("bookings.col.recordPayment")).toBeTruthy()
  })

  it("appears for a COMPLETED booking that still owes money (was previously null)", () => {
    mockMutations()
    const { container } = render(
      <BookingActions
        booking={makeBooking("completed", { invoice: invoiceWithOutstanding })}
        onAction={vi.fn()}
      />,
    )
    expect(container.firstChild).not.toBeNull()
    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    expect(findDropdownItem("bookings.col.recordPayment")).toBeTruthy()
  })

  it("appears for a confirmed booking with no invoice but a price + client (pay-at-clinic)", () => {
    mockMutations()
    render(
      <BookingActions
        booking={makeBooking("confirmed", { priceSnapshot: 50000 })}
        onAction={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    expect(findDropdownItem("bookings.col.recordPayment")).toBeTruthy()
  })

  it("is absent for a historical import even when it has an outstanding invoice", () => {
    mockMutations()
    const { container } = render(
      <BookingActions
        booking={makeBooking("completed", {
          isHistoricalImport: true,
          invoice: invoiceWithOutstanding,
        })}
        onAction={vi.fn()}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("is absent when canDo always returns false (no collect/create/manage)", () => {
    mockMutations()
    mockAuth(() => false) // canDo always returns false
    render(
      <BookingActions
        booking={makeBooking("confirmed", { invoice: invoiceWithOutstanding })}
        onAction={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    expect(findDropdownItem("bookings.col.recordPayment")).toBeUndefined()
    // Status actions still render — only collect is gated by permission.
    expect(findDropdownItem("complete")).toBeTruthy()
  })

  it("appears when canDo grants payment:create + invoice:create (RECEPTIONIST)", () => {
    // The collect gate was lowered from manage:Payment to create:Payment +
    // create:Invoice under BK-COLLECT-P0 so the built-in RECEPTIONIST role
    // can collect without 403. The dashboard predicate accepts create as
    // well as manage (manage is a CASL superset of create).
    mockMutations()
    mockAuth((module: string, action: string) => {
      const grants = ["payment:create", "invoice:create"]
      return grants.includes(`${module.toLowerCase()}:${action.toLowerCase()}`)
    })
    render(
      <BookingActions
        booking={makeBooking("confirmed", { invoice: invoiceWithOutstanding })}
        onAction={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    expect(findDropdownItem("bookings.col.recordPayment")).toBeTruthy()
  })

  it("is absent for a bank transfer awaiting verification", () => {
    mockMutations()
    render(
      <BookingActions
        booking={makeBooking("confirmed", {
          invoice: invoiceWithOutstanding,
          payment: awaitingPayment,
        })}
        onAction={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    expect(findDropdownItem("bookings.col.recordPayment")).toBeUndefined()
  })

  it("opens the RecordPaymentDialog after a successful complete on a still-owing booking", async () => {
    const { completeMut } = mockMutations()
    completeMut.mutateAsync.mockResolvedValueOnce({ id: "bk-1" })
    render(
      <BookingActions
        booking={makeBooking("confirmed", { invoice: invoiceWithOutstanding })}
        onAction={vi.fn()}
      />,
    )

    // Dialog should not be open before the action.
    expect(screen.queryByTestId("record-payment-dialog")).toBeNull()

    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    fireEvent.click(findDropdownItem("complete")!)

    await waitFor(() => {
      expect(screen.getByTestId("record-payment-dialog")).toBeTruthy()
    })
  })

  it("does NOT auto-open the dialog when completing an already-paid booking", async () => {
    const { completeMut } = mockMutations()
    completeMut.mutateAsync.mockResolvedValueOnce({ id: "bk-1" })
    // No invoice, no priceSnapshot → canCollect is false.
    render(<BookingActions booking={makeBooking("confirmed")} onAction={vi.fn()} />)

    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    fireEvent.click(findDropdownItem("complete")!)

    // Let microtasks settle.
    await Promise.resolve()
    await Promise.resolve()
    expect(screen.queryByTestId("record-payment-dialog")).toBeNull()
  })

  // ─── W2 fix: FAILED complete must NOT open the collect dialog ───────────────
  // Previously `run` swallowed the error and returned a resolved promise, so
  // the `.then(() => { if (canCollect) setCollectOpen(true) })` callback ran
  // after a rejected mutation too — offering collect on a booking the server
  // had just refused to complete. `run` now returns a boolean and the open
  // is gated on it.

  it("does NOT auto-open the dialog when completing a still-owing booking FAILS", async () => {
    const { completeMut } = mockMutations()
    completeMut.mutateAsync.mockRejectedValueOnce(
      new ApiError(503, "Service Unavailable", { requestId: "req-collect-fail" }),
    )
    const toastModule = await import("sonner")
    const toastErrorSpy = vi.spyOn(toastModule.toast, "error")

    render(
      <BookingActions
        booking={makeBooking("confirmed", { invoice: invoiceWithOutstanding })}
        onAction={vi.fn()}
      />,
    )

    // Dialog should not be open before the action.
    expect(screen.queryByTestId("record-payment-dialog")).toBeNull()

    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    fireEvent.click(findDropdownItem("complete")!)

    // Error toast still shown via showApiError.
    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("req-collect-fail"),
      )
    })
    // Dialog must remain closed — this is the regression we're fixing.
    expect(screen.queryByTestId("record-payment-dialog")).toBeNull()
  })
})