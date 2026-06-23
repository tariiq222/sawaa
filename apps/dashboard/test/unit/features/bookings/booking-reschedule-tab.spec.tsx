/**
 * booking-reschedule-tab.spec.tsx
 *
 * Tests BookingRescheduleTab: form fields, slot-fetch gating,
 * successful submission, error handling.  Uses real
 * rescheduleBookingSchema zod validation.
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

const {
  useCreateBookingSlots,
} = vi.hoisted(() => ({
  useCreateBookingSlots: vi.fn(),
}))

const { useLocale } = vi.hoisted(() => ({
  useLocale: vi.fn(() => ({ t: (k: string) => k, locale: "ar" })),
}))

vi.mock("@/hooks/use-bookings", () => ({ useBookingMutations }))
vi.mock("@/components/features/bookings/use-booking-slots", () => ({ useCreateBookingSlots }))
vi.mock("@/components/locale-provider", () => ({ useLocale }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => null,
}))

vi.mock("@sawaa/ui", () => {
  return {
    Button: ({ children, disabled, type, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button type={type} disabled={disabled} onClick={onClick} {...props}>{children}</button>
    ),
    Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
    DatePicker: ({ value, onChange, placeholder }: { value?: string; onChange?: (v: string) => void; placeholder?: string }) => (
      <input
        data-testid="date-picker"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
      />
    ),
    Select: ({ disabled, children }: { disabled?: boolean; children: React.ReactNode }) => (
      <div data-testid="select" data-disabled={disabled}>{children}</div>
    ),
    SelectContent: ({ children }: { children: React.ReactNode }) => <div data-testid="select-content">{children}</div>,
    SelectItem: ({ value, children, onValueChange }: { value?: string; children: React.ReactNode; onValueChange?: (v: string) => void }) => (
      <div
        data-testid={`select-item-${value}`}
        data-value={value}
        onClick={() => onValueChange?.(value ?? "")}
      >
        {children}
      </div>
    ),
    SelectTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="select-trigger">{children}</div>,
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span data-testid="select-placeholder">{placeholder ?? ""}</span>,
  }
})

vi.mock("@/components/ui/date-picker", () => {
  return {
    DatePicker: ({ value, onChange, placeholder }: { value?: string; onChange?: (v: string) => void; placeholder?: string }) => (
      <input
        data-testid="date-picker"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
      />
    ),
  }
})

vi.mock("@/components/features/bookings/use-booking-form-resets", () => ({
  useBookingEditDateReset: vi.fn(),
}))

import { BookingRescheduleTab } from "@/components/features/bookings/booking-reschedule-tab"

const makeBooking = (overrides: Partial<Booking> = {}): Booking =>
  ({
    id: "bk-1",
    status: "confirmed",
    clientId: "cli-1",
    serviceId: "svc-1",
    employeeId: "emp-1",
    date: "2026-06-01",
    startTime: "09:00",
    type: "in_person",
    ...overrides,
  } as Booking)

function mockSlots(overrides: {
  slots?: Array<{ startTime: string; endTime: string }>
  slotsLoading?: boolean
  canFetchSlots?: boolean
} = {}) {
  const { slots = [], slotsLoading = false, canFetchSlots = false } = overrides
  useCreateBookingSlots.mockReturnValue({ slots, slotsLoading, canFetchSlots })
}

function mockMutations(overrides: Record<string, { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean } | object> = {}) {
  const empty = { mutateAsync: vi.fn(), isPending: false }
  const all = { rescheduleMut: { ...empty, ...(overrides.rescheduleMut as object) } }
  useBookingMutations.mockReturnValue(all)
  return all
}

describe("BookingRescheduleTab", () => {
  beforeEach(() => { vi.clearAllMocks() })

  // ─── Slot-fetch gating ───────────────────────────────────────────────────────

  it("time select is disabled when canFetchSlots is false (no date selected yet)", () => {
    mockSlots({ slots: [], canFetchSlots: false })
    mockMutations()
    render(<BookingRescheduleTab booking={makeBooking()} onSuccess={vi.fn()} />)

    const select = screen.getByTestId("select")
    expect(select).toHaveAttribute("data-disabled", "true")
  })

  it("time select is enabled when canFetchSlots is true", () => {
    mockSlots({ slots: [{ startTime: "09:00", endTime: "09:30" }], canFetchSlots: true })
    mockMutations()
    render(<BookingRescheduleTab booking={makeBooking()} onSuccess={vi.fn()} />)

    const select = screen.getByTestId("select")
    expect(select).toHaveAttribute("data-disabled", "false")
  })

  // ─── Empty slots state ───────────────────────────────────────────────────────

  it("shows empty slot item when slots array is empty and not loading", () => {
    mockSlots({ slots: [], slotsLoading: false, canFetchSlots: true })
    mockMutations()
    render(<BookingRescheduleTab booking={makeBooking()} onSuccess={vi.fn()} />)

    expect(screen.getByTestId("select-item-__empty__")).toBeTruthy()
  })

  it("does not show empty slot item while slots are loading", () => {
    mockSlots({ slots: [], slotsLoading: true, canFetchSlots: true })
    mockMutations()
    render(<BookingRescheduleTab booking={makeBooking()} onSuccess={vi.fn()} />)

    expect(screen.queryByTestId("select-item-__empty__")).toBeNull()
  })

  it("renders available slot items from useCreateBookingSlots", () => {
    mockSlots({
      slots: [
        { startTime: "09:00", endTime: "09:30" },
        { startTime: "10:00", endTime: "10:30" },
      ],
      slotsLoading: false,
      canFetchSlots: true,
    })
    mockMutations()
    render(<BookingRescheduleTab booking={makeBooking()} onSuccess={vi.fn()} />)

    expect(screen.getByTestId("select-item-09:00")).toBeTruthy()
    expect(screen.getByTestId("select-item-10:00")).toBeTruthy()
  })

  // ─── Submission ──────────────────────────────────────────────────────────────

  it("calls rescheduleMut.mutateAsync with booking id and current form values on submit", async () => {
    mockSlots({
      slots: [{ startTime: "14:00", endTime: "14:30" }],
      slotsLoading: false,
      canFetchSlots: true,
    })
    const { rescheduleMut } = mockMutations()
    rescheduleMut.mutateAsync.mockResolvedValueOnce({ id: "bk-1" })
    render(<BookingRescheduleTab booking={makeBooking()} onSuccess={vi.fn()} />)

    fireEvent.click(screen.getByText("bookings.reschedule.submit"))

    await waitFor(() => {
      expect(rescheduleMut.mutateAsync).toHaveBeenCalledWith({
        id: "bk-1",
        date: "2026-06-01",
        startTime: "09:00",
      })
    })
  })

  it("calls onSuccess callback after successful reschedule", async () => {
    mockSlots({
      slots: [{ startTime: "14:00", endTime: "14:30" }],
      slotsLoading: false,
      canFetchSlots: true,
    })
    const { rescheduleMut } = mockMutations()
    rescheduleMut.mutateAsync.mockResolvedValueOnce({ id: "bk-1" })
    const onSuccess = vi.fn()

    render(<BookingRescheduleTab booking={makeBooking()} onSuccess={onSuccess} />)
    fireEvent.click(screen.getByText("bookings.reschedule.submit"))

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  })

  // ─── Error handling ─────────────────────────────────────────────────────────

  it("shows error toast with requestId when reschedule fails with ApiError >= 500", async () => {
    const { ApiError } = await import("@/lib/api")
    const { rescheduleMut } = mockMutations()
    rescheduleMut.mutateAsync.mockRejectedValue(
      new ApiError(503, "Service Unavailable", { requestId: "req-abc" }),
    )
    mockSlots({
      slots: [{ startTime: "14:00", endTime: "14:30" }],
      slotsLoading: false,
      canFetchSlots: true,
    })
    const toastModule = await import("sonner")
    const toastErrorSpy = vi.spyOn(toastModule.toast, "error")
    render(<BookingRescheduleTab booking={makeBooking()} onSuccess={vi.fn()} />)

    fireEvent.click(screen.getByText("bookings.reschedule.submit"))

    await waitFor(() => {
      expect(toastErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("req-abc"),
      )
    })
  })

  it("shows localized fallback toast when reschedule fails with generic Error", async () => {
    mockSlots({
      slots: [{ startTime: "14:00", endTime: "14:30" }],
      slotsLoading: false,
      canFetchSlots: true,
    })
    const { rescheduleMut } = mockMutations()
    rescheduleMut.mutateAsync.mockRejectedValue(new Error("Unexpected failure"))
    const toastModule = await import("sonner")
    const toastErrorSpy = vi.spyOn(toastModule.toast, "error")
    render(<BookingRescheduleTab booking={makeBooking()} onSuccess={vi.fn()} />)

    fireEvent.click(screen.getByText("bookings.reschedule.submit"))

    await waitFor(() =>
      expect(toastErrorSpy).toHaveBeenCalledWith("bookings.reschedule.toast.error"),
    )
  })
})
