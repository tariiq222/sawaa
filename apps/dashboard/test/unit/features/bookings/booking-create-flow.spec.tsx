/**
 * booking-create-flow.spec.tsx
 *
 * Product-critical Booking Create Flow tests — pure state machine + BookingSummary.
 * No vi.mock hoisting issues: these tests use the real useBookingFormState.
 *
 * Covers the daily staff journey:
 *   select client → select service → select employee → select type
 *   → select duration → select date → select time
 *   → pay-at-clinic toggle → coupon code
 *
 * Test seams:
 *  - BookingSummary (component): clean prop interface, tested directly
 *  - useBookingFormState (hook): pure state machine, tested via renderHook
 */

import { renderHook, act } from "@testing-library/react"
import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import React from "react"

import { useBookingFormState } from "@/components/features/bookings/use-booking-form-state"
import { BookingSummary } from "@/components/features/bookings/booking-summary"

/* ─── Mocked locale ──────────────────────────────────────────────────────── */

const { useLocale } = vi.hoisted(() => ({
  useLocale: vi.fn(() => ({
    t: (k: string) => k,
    locale: "ar",
  })),
}))

const { useOrganizationConfig } = vi.hoisted(() => ({
  useOrganizationConfig: vi.fn(() => ({
    formatDate: (d: string) => d,
    formatTime: (t: string) => t,
  })),
}))

vi.mock("@/components/locale-provider", () => ({ useLocale }))
vi.mock("@/hooks/use-organization-config", () => ({ useOrganizationConfig }))

/* ─── Hugeicons stub ─────────────────────────────────────────────────────── */

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => null,
}))

/* ─── UI primitives ──────────────────────────────────────────────────────── */

vi.mock("@sawaa/ui", () => {
  const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    ({ value, onChange, placeholder, className, ...props }, ref) => (
      <input ref={ref} value={value ?? ""} onChange={onChange} placeholder={placeholder} className={className} {...props} />
    )
  )
  Input.displayName = "Input"

  const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: string }>(
    ({ children, disabled, className, ...props }, ref) => (
      <button ref={ref} disabled={disabled} className={className} {...props}>{children}</button>
    )
  )
  Button.displayName = "Button"

  return { Button, Input }
})

/* ─── FormattedCurrency stub ──────────────────────────────────────────────── */

vi.mock("@/components/features/shared/sar-symbol", () => ({
  FormattedCurrency: ({ amount, className }: { amount: number; className?: string }) => (
    <span className={className}>{amount}</span>
  ),
}))

/* ══════════════════════════════════════════════════════════════════════════
   BookingSummary component tests
   ══════════════════════════════════════════════════════════════════════════ */

describe("BookingSummary — submit blocking & interactions", () => {
  const defaultProps = {
    clientName: null,
    serviceName: null,
    employeeName: null,
    type: null,
    durationLabel: null,
    date: null,
    startTime: null,
    servicePriceHalalas: null as number | null,
    payAtClinic: false,
    couponCode: null as string | null,
    submitting: false,
    isComplete: false,
    onTogglePayAtClinic: vi.fn(),
    onCouponChange: vi.fn(),
    onSubmit: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("submit button is disabled when isComplete is false", () => {
    render(<BookingSummary {...defaultProps} />)
    const btn = screen.getByRole("button", { name: /bookings\.pos\.confirm/ })
    expect(btn).toBeDisabled()
  })

  it("submit button is enabled when isComplete is true", () => {
    render(
      <BookingSummary
        {...defaultProps}
        isComplete
        clientName="Sara"
        serviceName="Counseling"
        employeeName="Ahmad"
        type="in_person"
        date="2026-06-01"
        startTime="09:00"
      />,
    )
    const btn = screen.getByRole("button", { name: /bookings\.pos\.confirm/ })
    expect(btn).not.toBeDisabled()
  })

  it("submit button is disabled while submitting", () => {
    render(
      <BookingSummary
        {...defaultProps}
        isComplete
        submitting
        clientName="Sara"
        serviceName="Counseling"
        employeeName="Ahmad"
        type="in_person"
        date="2026-06-01"
        startTime="09:00"
      />,
    )
    const btn = screen.getByRole("button", { name: /bookings\.pos\.confirm/ })
    expect(btn).toBeDisabled()
  })

  it("pay-at-clinic toggle is rendered and clickable", () => {
    const toggle = vi.fn()
    render(<BookingSummary {...defaultProps} onTogglePayAtClinic={toggle} />)
    const option = screen.getByText("bookings.wizard.step.confirm.payAtClinic")
    fireEvent.click(option)
    expect(toggle).toHaveBeenCalledWith(true)
  })

  it("coupon input calls onCouponChange on type", () => {
    const change = vi.fn()
    render(<BookingSummary {...defaultProps} onCouponChange={change} />)
    const input = screen.getByPlaceholderText("bookings.wizard.step.confirm.couponPlaceholder")
    fireEvent.change(input, { target: { value: "SAVE20" } })
    expect(change).toHaveBeenCalledWith("SAVE20")
  })

  it("coupon input calls onCouponChange with null when cleared", () => {
    const change = vi.fn()
    render(<BookingSummary {...defaultProps} couponCode="SAVE20" onCouponChange={change} />)
    const input = screen.getByDisplayValue("SAVE20")
    fireEvent.change(input, { target: { value: "" } })
    expect(change).toHaveBeenCalledWith(null)
  })

  it("pay-at-clinic option shows selected state visually", () => {
    const { container } = render(<BookingSummary {...defaultProps} payAtClinic />)
    const option = container.querySelector(".bg-primary\\/5")
    expect(option).not.toBeNull()
  })

  it("calls onSubmit when confirm button is clicked while isComplete is true", () => {
    const onSubmit = vi.fn()
    render(
      <BookingSummary
        {...defaultProps}
        isComplete
        onSubmit={onSubmit}
        clientName="Sara"
        serviceName="Counseling"
        employeeName="Ahmad"
        type="in_person"
        date="2026-06-01"
        startTime="09:00"
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /bookings\.pos\.confirm/ }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   useBookingFormState — daily staff create-flow (pure state machine)
   NOTE: these tests use the REAL useBookingFormState — no vi.mock on the hook
   ══════════════════════════════════════════════════════════════════════════ */

describe("useBookingFormState — internal state machine", () => {
  it("isComplete is false with zero fields set", () => {
    const { result } = renderHook(() => useBookingFormState())
    expect(result.current.isComplete).toBe(false)
  })

  it("isComplete is false when only clientId is set", () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => { result.current.selectClient("cli-1", "Sara") })
    expect(result.current.isComplete).toBe(false)
  })

  it("isComplete is false when client + service are set", () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient("cli-1", "Sara")
      result.current.selectService("svc-1", "Counseling")
    })
    expect(result.current.isComplete).toBe(false)
  })

  it("isComplete is false when client + service + employee are set", () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient("cli-1", "Sara")
      result.current.selectService("svc-1", "Counseling")
      result.current.selectEmployee("emp-1", "Ahmad")
    })
    expect(result.current.isComplete).toBe(false)
  })

  it("isComplete is false when type is added but no datetime", () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient("cli-1", "Sara")
      result.current.selectService("svc-1", "Counseling")
      result.current.selectEmployee("emp-1", "Ahmad")
      result.current.selectType("in_person")
    })
    expect(result.current.isComplete).toBe(false)
  })

  it("isComplete is false when date is set but time is not", () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient("cli-1", "Sara")
      result.current.selectService("svc-1", "Counseling")
      result.current.selectEmployee("emp-1", "Ahmad")
      result.current.selectType("in_person")
      result.current.selectDate("2026-06-01")
    })
    expect(result.current.isComplete).toBe(false)
  })

  it("isComplete flips true once all required fields are set", () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient("cli-1", "Sara")
      result.current.selectService("svc-1", "Counseling")
      result.current.selectEmployee("emp-1", "Ahmad")
      result.current.selectType("in_person")
      result.current.selectDate("2026-06-01")
      result.current.selectTime("09:00")
    })
    expect(result.current.isComplete).toBe(true)
  })

  it("isComplete stays true when payAtClinic is toggled", () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient("cli-1", "Sara")
      result.current.selectService("svc-1", "Counseling")
      result.current.selectEmployee("emp-1", "Ahmad")
      result.current.selectType("in_person")
      result.current.selectDate("2026-06-01")
      result.current.selectTime("09:00")
    })
    act(() => { result.current.setPayAtClinic(true) })
    expect(result.current.isComplete).toBe(true)
  })

  it("isComplete stays true when couponCode is set", () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient("cli-1", "Sara")
      result.current.selectService("svc-1", "Counseling")
      result.current.selectEmployee("emp-1", "Ahmad")
      result.current.selectType("in_person")
      result.current.selectDate("2026-06-01")
      result.current.selectTime("09:00")
    })
    act(() => { result.current.setCouponCode("SAVE20") })
    expect(result.current.isComplete).toBe(true)
  })

  it("final state has correct field values for in-person booking", () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient("cli-1", "Sara")
      result.current.selectService("svc-1", "Counseling")
      result.current.selectEmployee("emp-1", "Ahmad")
      result.current.selectType("in_person")
      result.current.selectDate("2026-06-01")
      result.current.selectTime("09:00")
      result.current.setPayAtClinic(true)
      result.current.setCouponCode("SAVE20")
    })
    const s = result.current.state
    expect(s.clientId).toBe("cli-1")
    expect(s.serviceId).toBe("svc-1")
    expect(s.employeeId).toBe("emp-1")
    expect(s.type).toBe("in_person")
    expect(s.date).toBe("2026-06-01")
    expect(s.startTime).toBe("09:00")
    expect(s.payAtClinic).toBe(true)
    expect(s.couponCode).toBe("SAVE20")
  })

  it("final state has correct field values for online booking", () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient("cli-2", "Nora")
      result.current.selectService("svc-2", "Family Therapy")
      result.current.selectEmployee("emp-2", "Layla")
      result.current.selectType("online")
      result.current.selectDate("2026-07-15")
      result.current.selectTime("14:30")
    })
    const s = result.current.state
    expect(s.clientId).toBe("cli-2")
    expect(s.serviceId).toBe("svc-2")
    expect(s.employeeId).toBe("emp-2")
    expect(s.type).toBe("online")
    expect(s.date).toBe("2026-07-15")
    expect(s.startTime).toBe("14:30")
    expect(s.payAtClinic).toBe(true)
    expect(s.couponCode).toBeNull()
  })

  it("selectService clears employeeId, type, duration, date, time", () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient("cli-1", "Sara")
      result.current.selectService("svc-1", "Counseling")
      result.current.selectEmployee("emp-1", "Ahmad")
      result.current.selectType("in_person")
      result.current.selectDate("2026-06-01")
      result.current.selectTime("09:00")
    })
    act(() => {
      result.current.selectService("svc-2", "Family Therapy")
    })
    const s = result.current.state
    expect(s.serviceId).toBe("svc-2")
    expect(s.employeeId).toBeNull()
    expect(s.type).toBeNull()
    expect(s.date).toBeNull()
    expect(s.startTime).toBeNull()
    expect(s.clientId).toBe("cli-1")
  })

  it("selectClient clears all downstream fields", () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient("cli-1", "Sara")
      result.current.selectService("svc-1", "Counseling")
      result.current.selectEmployee("emp-1", "Ahmad")
      result.current.selectType("in_person")
      result.current.selectDate("2026-06-01")
      result.current.selectTime("09:00")
    })
    act(() => {
      result.current.selectClient("cli-2", "Nora")
    })
    const s = result.current.state
    expect(s.clientId).toBe("cli-2")
    expect(s.serviceId).toBeNull()
    expect(s.employeeId).toBeNull()
    expect(s.type).toBeNull()
    expect(s.date).toBeNull()
    expect(s.startTime).toBeNull()
  })

  it("selectType resets downstream fields but preserves client/service/employee", () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient("cli-1", "Sara")
      result.current.selectService("svc-1", "Counseling")
      result.current.selectEmployee("emp-1", "Ahmad")
      result.current.selectType("in_person")
      result.current.selectDate("2026-06-01")
      result.current.selectTime("09:00")
    })
    act(() => {
      result.current.selectType("online")
    })
    const s = result.current.state
    expect(s.clientId).toBe("cli-1")
    expect(s.serviceId).toBe("svc-1")
    expect(s.employeeId).toBe("emp-1")
    expect(s.type).toBe("online")
    expect(s.date).toBeNull()
    expect(s.startTime).toBeNull()
  })

  it("selectDuration resets downstream fields", () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient("cli-1", "Sara")
      result.current.selectService("svc-1", "Counseling")
      result.current.selectEmployee("emp-1", "Ahmad")
      result.current.selectType("in_person")
      result.current.selectDate("2026-06-01")
      result.current.selectTime("09:00")
    })
    act(() => {
      result.current.selectDuration("dur-45", "45 دقيقة", null)
    })
    const s = result.current.state
    expect(s.durationOptionId).toBe("dur-45")
    expect(s.durationLabel).toBe("45 دقيقة")
    expect(s.date).toBeNull()
    expect(s.startTime).toBeNull()
  })

  it("reset returns all fields to initial state", () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient("cli-1", "Sara")
      result.current.selectService("svc-1", "Counseling")
      result.current.setPayAtClinic(true)
      result.current.setCouponCode("SAVE20")
    })
    act(() => { result.current.reset() })
    const s = result.current.state
    expect(s.clientId).toBeNull()
    expect(s.serviceId).toBeNull()
    expect(s.payAtClinic).toBe(true)
    expect(s.couponCode).toBeNull()
    expect(result.current.isComplete).toBe(false)
  })
})
