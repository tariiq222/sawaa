/**
 * booking-actions-dialogs.spec.tsx
 *
 * Tests for BookingActions cancel-dialog flows:
 * AdminCancelDialog, ApproveCancelDialog, RejectCancelDialog.
 * Extracted from booking-actions.spec.tsx to keep it ≤350 lines.
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

vi.mock("@/hooks/use-bookings", () => ({ useBookingMutations }))
vi.mock("@/components/locale-provider", () => ({ useLocale }))

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
    Sheet: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (open ? <div data-testid="sheet">{children}</div> : null),
    SheetContent: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet-content">{children}</div>,
    SheetHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet-header">{children}</div>,
    SheetTitle: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet-title">{children}</div>,
    SheetDescription: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet-desc">{children}</div>,
    SheetFooter: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet-footer">{children}</div>,
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
    adminCancelMut: { ...empty, ...(overrides.adminCancelMut as object) },
  }
  useBookingMutations.mockReturnValue(all)
  return all
}

function findDropdownItem(text: string) {
  const items = screen.getByTestId("dropdown-content").querySelectorAll("[data-testid='dropdown-item']")
  return Array.from(items).find((el) => el.textContent?.includes(text))
}

describe("BookingActions – Dialogs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ─── Admin Cancel Dialog ─────────────────────────────────────────────────────

  describe("AdminCancelDialog", () => {
    it("disables the confirm button until a cancellation reason is picked", async () => {
      mockMutations()
      render(<BookingActions booking={makeBooking("confirmed")} onAction={vi.fn()} />)

      fireEvent.click(screen.getByTestId("dropdown-trigger"))
      fireEvent.click(findDropdownItem("cancel")!)
      expect(screen.getByTestId("sheet")).toBeTruthy()

      const sheetFooter = screen.getByTestId("sheet-footer")
      const cancelBtn = sheetFooter.querySelector("button:last-child") as HTMLButtonElement
      // No reason selected yet → button disabled (validation enforced by `disabled` prop, not toast).
      expect(cancelBtn.disabled).toBe(true)
    })

    it("enables the confirm button once a reason is selected", async () => {
      mockMutations()
      render(<BookingActions booking={makeBooking("confirmed")} onAction={vi.fn()} />)

      fireEvent.click(screen.getByTestId("dropdown-trigger"))
      fireEvent.click(findDropdownItem("cancel")!)

      // The mocked <Select> calls onValueChange("partial") on click — wires a reason in.
      fireEvent.click(screen.getByTestId("select"))

      await waitFor(() => {
        const sheetFooter = screen.getByTestId("sheet-footer")
        const cancelBtn = sheetFooter.querySelector("button:last-child") as HTMLButtonElement
        expect(cancelBtn.disabled).toBe(false)
      })
    })
  })

  // ─── Approve Cancel Dialog ──────────────────────────────────────────────────

  describe("ApproveCancelDialog", () => {
    it("shows refund-amount-required error for partial refund with no amount", async () => {
      const toastModule = await import("sonner")
      const toastErrorSpy = vi.spyOn(toastModule.toast, "error")
      mockMutations()
      render(
        <BookingActions
          booking={makeBooking("cancel_requested", { suggestedRefundType: "partial" })}
          onAction={vi.fn()}
        />,
      )

      fireEvent.click(screen.getByTestId("dropdown-trigger"))
      fireEvent.click(findDropdownItem("approve")!)

      fireEvent.click(screen.getByTestId("select"))

      const sheetFooter = screen.getByTestId("sheet-footer")
      const approveBtn = sheetFooter.querySelector("button:last-child") as HTMLButtonElement
      fireEvent.click(approveBtn)

      await waitFor(() => {
        expect(toastErrorSpy).toHaveBeenCalledWith("bookings.actions.validation.refundAmountRequired")
      })
    })
  })
})
