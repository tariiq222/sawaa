/**
 * booking-actions.spec.tsx — BookingActions: status→actions, mutations, loading, error toasts.
 * Dialog tests are in booking-actions-dialogs.spec.tsx.
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
    adminCancelMut: { ...empty, ...(overrides.adminCancelMut as object) },
  }
  useBookingMutations.mockReturnValue(all)
  return all
}

function findDropdownItem(text: string) {
  const items = screen.getByTestId("dropdown-content").querySelectorAll("[data-testid='dropdown-item']")
  return Array.from(items).find((el) => el.textContent?.includes(text))
}

describe("BookingActions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ─── Null when no actions available ─────────────────────────────────────────

  it.each([
    { status: "completed" as const },
    { status: "cancelled" as const },
    { status: "no_show" as const },
  ])("returns null for $status (no actions)", ({ status }) => {
    mockMutations()
    const { container } = render(<BookingActions booking={makeBooking(status)} onAction={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  // ─── Dropdown renders for actionable statuses ─────────────────────────────────

  it.each([
    { status: "pending" as const },
    { status: "confirmed" as const },
    { status: "cancel_requested" as const },
  ])("renders dropdown for $status", ({ status }) => {
    mockMutations()
    render(<BookingActions booking={makeBooking(status)} onAction={vi.fn()} />)
    expect(screen.getByTestId("dropdown")).toBeTruthy()
  })

  // ─── Action handlers ────────────────────────────────────────────────────────

  it('"confirm" calls confirmMut.mutateAsync with booking id', async () => {
    const { confirmMut } = mockMutations()
    confirmMut.mutateAsync.mockResolvedValueOnce({ id: "bk-1" })
    render(<BookingActions booking={makeBooking("pending")} onAction={vi.fn()} />)

    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    fireEvent.click(findDropdownItem("confirm")!)

    expect(confirmMut.mutateAsync).toHaveBeenCalledWith("bk-1")
  })

  it('"complete" calls completeMut.mutateAsync with booking id', async () => {
    const { completeMut } = mockMutations()
    completeMut.mutateAsync.mockResolvedValueOnce({ id: "bk-1" })
    render(<BookingActions booking={makeBooking("confirmed")} onAction={vi.fn()} />)

    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    fireEvent.click(findDropdownItem("complete")!)

    expect(completeMut.mutateAsync).toHaveBeenCalledWith("bk-1")
  })

  it('"noshow" calls noShowMut.mutateAsync with booking id', async () => {
    const { noShowMut } = mockMutations()
    noShowMut.mutateAsync.mockResolvedValueOnce({ id: "bk-1" })
    render(<BookingActions booking={makeBooking("confirmed")} onAction={vi.fn()} />)

    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    fireEvent.click(findDropdownItem("noshow")!)

    expect(noShowMut.mutateAsync).toHaveBeenCalledWith("bk-1")
  })

  it('"cancel" opens admin cancel dialog without calling mutation', () => {
    mockMutations()
    render(<BookingActions booking={makeBooking("confirmed")} onAction={vi.fn()} />)

    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    fireEvent.click(findDropdownItem("cancel")!)

    expect(screen.getByTestId("sheet")).toBeTruthy()
  })

  it('"approve_cancel" opens approve dialog', () => {
    mockMutations()
    render(
      <BookingActions
        booking={makeBooking("cancel_requested", { suggestedRefundType: "partial" })}
        onAction={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    fireEvent.click(findDropdownItem("approve")!)

    expect(screen.getByTestId("sheet")).toBeTruthy()
  })

  it('"reject_cancel" fires genericError toast and resets dialog', async () => {
    const toastModule = await import("sonner")
    const toastErrorSpy = vi.spyOn(toastModule.toast, "error")
    mockMutations()
    render(
      <BookingActions
        booking={makeBooking("cancel_requested")}
        onAction={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    fireEvent.click(findDropdownItem("reject")!)
    expect(screen.getByTestId("sheet")).toBeTruthy()

    // Click the Reject button inside the dialog sheet-footer
    const sheetFooter = screen.getByTestId("sheet-footer")
    const rejectBtn = sheetFooter.querySelector("button:last-child") as HTMLButtonElement
    fireEvent.click(rejectBtn)

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledWith("bookings.actions.toast.genericError")
    })
  })

  // ─── Loading state ───────────────────────────────────────────────────────────

  it("DropdownMenuTrigger inherits disabled when a mutation is pending", () => {
    mockMutations({ confirmMut: { mutateAsync: vi.fn(), isPending: true } })
    render(<BookingActions booking={makeBooking("pending")} onAction={vi.fn()} />)
    const trigger = screen.getByTestId("dropdown-trigger")
    expect(trigger.querySelector("[disabled]")).toBeTruthy()
  })

  // ─── Error handling ─────────────────────────────────────────────────────────

  it("ApiError with status >= 500 shows server-error toast with requestId", async () => {
    const { confirmMut } = mockMutations()
    confirmMut.mutateAsync.mockRejectedValue(
      new ApiError(503, "Service Unavailable", { requestId: "req-999" }),
    )
    const toastModule = await import("sonner")
    const toastErrorSpy = vi.spyOn(toastModule.toast, "error")
    render(<BookingActions booking={makeBooking("pending")} onAction={vi.fn()} />)

    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    fireEvent.click(findDropdownItem("confirm")!)

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("req-999"),
      )
    })
  })

  it("generic Error shows toast with error message", async () => {
    const { completeMut } = mockMutations()
    completeMut.mutateAsync.mockRejectedValue(new Error("Network failure"))
    const toastModule = await import("sonner")
    const toastErrorSpy = vi.spyOn(toastModule.toast, "error")
    render(<BookingActions booking={makeBooking("confirmed")} onAction={vi.fn()} />)

    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    fireEvent.click(findDropdownItem("complete")!)

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledWith("Network failure")
    })
  })

  // ─── Success flow ───────────────────────────────────────────────────────────

  it("successful action calls onAction callback", async () => {
    const { confirmMut } = mockMutations()
    confirmMut.mutateAsync.mockResolvedValueOnce({ id: "bk-1" })
    const onAction = vi.fn()
    render(<BookingActions booking={makeBooking("pending")} onAction={onAction} />)

    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    fireEvent.click(findDropdownItem("confirm")!)

    await waitFor(() => expect(onAction).toHaveBeenCalled())
  })

  // ─── Status label rendering ─────────────────────────────────────────────────

  it.each([
    { status: "pending" as const, pattern: /pending/i },
    { status: "confirmed" as const, pattern: /confirmed/i },
  ])('shows correct status label for "$status"', ({ status, pattern }) => {
    mockMutations()
    render(<BookingActions booking={makeBooking(status)} onAction={vi.fn()} />)
    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    expect(screen.getByTestId("dropdown-label")).toHaveTextContent(pattern)
  })

  // ─── Error path: ApiError < 500 uses generic message ───────────────────────

  it("ApiError with status 400 shows generic error toast message", async () => {
    const { completeMut } = mockMutations()
    completeMut.mutateAsync.mockRejectedValue(
      new ApiError(400, "Bad Request", { requestId: "req-bad" }),
    )
    const toastModule = await import("sonner")
    const toastErrorSpy = vi.spyOn(toastModule.toast, "error")
    render(<BookingActions booking={makeBooking("confirmed")} onAction={vi.fn()} />)

    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    fireEvent.click(findDropdownItem("complete")!)

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledWith("Bad Request")
    })
  })

  // ─── pending_group_fill and awaiting_payment share pending actions ───────────

  it.each([
    { status: "pending_group_fill" as const },
    { status: "awaiting_payment" as const },
  ])("renders dropdown for $status status", ({ status }) => {
    mockMutations()
    render(<BookingActions booking={makeBooking(status)} onAction={vi.fn()} />)
    expect(screen.getByTestId("dropdown")).toBeTruthy()
  })

  it("cancel_requested status shows cancel_requested label and two action items", () => {
    mockMutations()
    render(<BookingActions booking={makeBooking("cancel_requested")} onAction={vi.fn()} />)
    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    const label = screen.getByTestId("dropdown-label")
    expect(label).toHaveTextContent(/cancel_requested/i)
    const items = screen.getByTestId("dropdown-content").querySelectorAll("[data-testid='dropdown-item']")
    expect(items).toHaveLength(2)
  })

  it("expired status returns null (no actions)", () => {
    mockMutations()
    const { container } = render(<BookingActions booking={makeBooking("expired")} onAction={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })
})
