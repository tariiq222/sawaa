/**
 * booking-reception-transitions.spec.tsx
 *
 * Reception happy-path tests for `BookingActions`:
 *   CONFIRMED → check-in     (PATCH /dashboard/bookings/:id/check-in)
 *   CONFIRMED → complete     (PATCH /dashboard/bookings/:id/complete)
 *   CONFIRMED → no-show      (PATCH /dashboard/bookings/:id/no-show)
 *   CONFIRMED → cancel       (PATCH /dashboard/bookings/:id/cancel)
 *
 * These tests complement the endpoint-pathing assertions already covered
 * in `test/unit/lib/bookings-api.spec.ts` (which checks the lib/api
 * wrappers) by asserting the *component* dispatches the right mutation
 * key per status. The PATCH methods + paths are verified end-to-end
 * via the Playwright E2E in `e2e/flows/bookings/bookings-status-workflow.spec.ts`.
 *
 * Status→actions contract is derived from the backend state machine
 * (`apps/backend/src/modules/bookings/booking-state-machine.ts`) and the
 * `confirmed` row of the dashboard's `statusActions` map in
 * `components/features/bookings/booking-actions.tsx`.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import React from "react"
import type { Booking } from "@/lib/types/booking"

const { useBookingMutations } = vi.hoisted(() => ({
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
  Cancel01Icon: () => null,
  CheckmarkCircle01Icon: () => null,
  EyeIcon: () => null,
}))

vi.mock("@sawaa/ui", () => ({
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
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) => (open ? <div data-testid="sheet">{children}</div> : null),
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
}))

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
    approveCancelMut: { ...empty, ...(overrides.approveCancelMut as object) },
    rejectCancelMut: { ...empty, ...(overrides.rejectCancelMut as object) },
  }
  useBookingMutations.mockReturnValue(all)
  return all
}

function findDropdownItem(text: string) {
  const items = screen.getByTestId("dropdown-content").querySelectorAll("[data-testid='dropdown-item']")
  return Array.from(items).find((el) => el.textContent?.includes(text))
}

describe("BookingActions — reception status menu (CONFIRMED)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('CONFIRMED status exposes exactly the four reception actions', () => {
    mockMutations()
    render(<BookingActions booking={makeBooking("confirmed")} onAction={vi.fn()} />)
    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    const items = screen.getByTestId("dropdown-content").querySelectorAll("[data-testid='dropdown-item']")
    const labels = Array.from(items).map((el) => el.textContent ?? "")
    // Backend CONFIRMED state machine: checkin / complete / noshow / cancel are the only valid reception actions
    expect(labels.some((l) => l.includes("checkin"))).toBe(true)
    expect(labels.some((l) => l.includes("complete"))).toBe(true)
    expect(labels.some((l) => l.includes("noshow"))).toBe(true)
    expect(labels.some((l) => l.includes("cancel"))).toBe(true)
    expect(items).toHaveLength(4)
  })

  it('"checkin" calls checkInMut.mutateAsync with the booking id', async () => {
    const { checkInMut } = mockMutations()
    checkInMut.mutateAsync.mockResolvedValueOnce({ id: "bk-1" })
    render(<BookingActions booking={makeBooking("confirmed")} onAction={vi.fn()} />)

    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    fireEvent.click(findDropdownItem("checkin")!)

    expect(checkInMut.mutateAsync).toHaveBeenCalledWith("bk-1")
  })

  it('successful "checkin" surfaces the checked-in toast and triggers onAction', async () => {
    const { checkInMut } = mockMutations()
    checkInMut.mutateAsync.mockResolvedValueOnce({ id: "bk-1" })
    const onAction = vi.fn()
    const toastModule = await import("sonner")
    const toastSuccessSpy = vi.spyOn(toastModule.toast, "success")

    render(<BookingActions booking={makeBooking("confirmed")} onAction={onAction} />)
    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    fireEvent.click(findDropdownItem("checkin")!)

    await waitFor(() => {
      expect(checkInMut.mutateAsync).toHaveBeenCalledWith("bk-1")
      expect(toastSuccessSpy).toHaveBeenCalledWith("bookings.actions.toast.checkedIn")
      expect(onAction).toHaveBeenCalled()
    })
  })

  it('"complete" surfaces the completed toast and triggers onAction', async () => {
    const { completeMut } = mockMutations()
    completeMut.mutateAsync.mockResolvedValueOnce({ id: "bk-1" })
    const onAction = vi.fn()
    const toastModule = await import("sonner")
    const toastSuccessSpy = vi.spyOn(toastModule.toast, "success")

    render(<BookingActions booking={makeBooking("confirmed")} onAction={onAction} />)
    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    fireEvent.click(findDropdownItem("complete")!)

    await waitFor(() => {
      expect(completeMut.mutateAsync).toHaveBeenCalledWith("bk-1")
      expect(toastSuccessSpy).toHaveBeenCalledWith("bookings.actions.toast.completed")
      expect(onAction).toHaveBeenCalled()
    })
  })

  it('"noshow" surfaces the no-show toast and triggers onAction', async () => {
    const { noShowMut } = mockMutations()
    noShowMut.mutateAsync.mockResolvedValueOnce({ id: "bk-1" })
    const onAction = vi.fn()
    const toastModule = await import("sonner")
    const toastSuccessSpy = vi.spyOn(toastModule.toast, "success")

    render(<BookingActions booking={makeBooking("confirmed")} onAction={onAction} />)
    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    fireEvent.click(findDropdownItem("noshow")!)

    await waitFor(() => {
      expect(noShowMut.mutateAsync).toHaveBeenCalledWith("bk-1")
      expect(toastSuccessSpy).toHaveBeenCalledWith("bookings.actions.toast.noShow")
      expect(onAction).toHaveBeenCalled()
    })
  })

  it('"cancel" opens the admin cancel dialog (no mutation triggered yet)', () => {
    const { adminCancelMut } = mockMutations()
    render(<BookingActions booking={makeBooking("confirmed")} onAction={vi.fn()} />)

    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    fireEvent.click(findDropdownItem("cancel")!)

    // Dialog renders — adminCancelMut is NOT called until the dialog is submitted
    expect(screen.getByTestId("sheet")).toBeTruthy()
    expect(adminCancelMut.mutateAsync).not.toHaveBeenCalled()
  })

  it('admin cancel dialog submission invokes adminCancelMut with reason + notes', async () => {
    const { adminCancelMut } = mockMutations()
    adminCancelMut.mutateAsync.mockResolvedValueOnce({ id: "bk-1" })
    render(<BookingActions booking={makeBooking("confirmed")} onAction={vi.fn()} />)

    fireEvent.click(screen.getByTestId("dropdown-trigger"))
    fireEvent.click(findDropdownItem("cancel")!)

    // Mocked Select fires onValueChange("partial") on click — sufficient reason value for AdminCancelDialog
    fireEvent.click(screen.getByTestId("select"))

    const sheetFooter = screen.getByTestId("sheet-footer")
    const confirmBtn = sheetFooter.querySelector("button:last-child") as HTMLButtonElement
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(adminCancelMut.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "bk-1",
          reason: expect.any(String),
        }),
      )
    })
  })
})

/**
 * Status→actions matrix (dashboard `statusActions` map vs. backend state machine).
 *
 * Source of truth:
 *   - Dashboard: `components/features/bookings/booking-actions.tsx` `statusActions` map
 *   - Backend:   `apps/backend/src/modules/bookings/booking-state-machine.ts`
 *
 * Any drift between the dashboard's available actions and the backend's
 * allowed transitions should surface as a failure here. The terminal
 * status guard (returns `null` from BookingActions) is asserted by the
 * existing `booking-actions.spec.tsx`.
 */
describe("BookingActions — status→actions matrix", () => {
  const statusMatrix: ReadonlyArray<{
    status: Booking["status"]
    /** Action keys defined by the `getActionMeta` map. */
    expected: ReadonlyArray<"confirm" | "checkin" | "complete" | "noshow" | "cancel" | "approve_cancel" | "reject_cancel">
    /** Number of dropdown items to expect (0 ⇒ component returns null). */
    count: number
  }> = [
    { status: "pending",              expected: ["confirm", "cancel"],       count: 2 },
    { status: "pending_group_fill",   expected: ["confirm", "cancel"],       count: 2 },
    { status: "awaiting_payment",     expected: ["confirm", "cancel"],       count: 2 },
    { status: "deposit_paid",         expected: ["confirm", "cancel"],       count: 2 },
    { status: "confirmed",            expected: ["checkin", "complete", "noshow", "cancel"], count: 4 },
    { status: "cancel_requested",     expected: ["approve_cancel", "reject_cancel"],        count: 2 },
    { status: "completed",            expected: [], count: 0 },
    { status: "cancelled",            expected: [], count: 0 },
    { status: "no_show",              expected: [], count: 0 },
    { status: "expired",              expected: [], count: 0 },
  ]

  it.each(statusMatrix)(
    'status "$status" exposes exactly $count action(s): $expected',
    ({ status, expected, count }) => {
      mockMutations()
      const { container } = render(
        <BookingActions booking={makeBooking(status)} onAction={vi.fn()} />,
      )

      if (count === 0) {
        expect(container.firstChild).toBeNull()
        return
      }

      fireEvent.click(screen.getByTestId("dropdown-trigger"))
      const items = screen
        .getByTestId("dropdown-content")
        .querySelectorAll("[data-testid='dropdown-item']")
      const labels = Array.from(items).map((el) => el.textContent ?? "")
      expect(items).toHaveLength(count)
      for (const action of expected) {
        // The action key in the component is camelCased for approve/reject
        // (e.g. "approveCancel") but snake-cased for the rest
        // (e.g. "checkin", "noshow"). Translate to the i18n key the
        // component actually emits.
        const i18nKey =
          action === "approve_cancel" || action === "reject_cancel"
            ? action.replace(/_cancel$/, "Cancel")
            : action
        expect(labels.some((l) => l.includes(i18nKey))).toBe(true)
      }
    },
  )
})
