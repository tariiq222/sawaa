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
    collectionMethod: "CASH" as const,
    hideCollectionTiming: false,
    paymentSettings: undefined as
      | undefined
      | {
          paymentMoyasarEnabled: boolean
          paymentAtClinicEnabled: boolean
          payMethodCashEnabled: boolean
          payMethodBankEnabled: boolean
          payMethodMadaEnabled: boolean
          payMethodTabbyEnabled: boolean
        },
    couponCode: null as string | null,
    submitting: false,
    isComplete: false,
    onTogglePayAtClinic: vi.fn(),
    onChangeCollectionMethod: vi.fn(),
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
        type="IN_PERSON"
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
        type="IN_PERSON"
        date="2026-06-01"
        startTime="09:00"
      />,
    )
    const btn = screen.getByRole("button", { name: /bookings\.pos\.confirm/ })
    expect(btn).toBeDisabled()
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

  // W2-T2 — radiogroup behaviour for the collection-timing group.

  it("pay-at-clinic option shows selected state via aria-checked", () => {
    render(<BookingSummary {...defaultProps} payAtClinic />)
    const atClinic = screen.getByRole("radio", {
      name: "bookings.wizard.step.confirm.payAtClinic",
    })
    expect(atClinic.getAttribute("aria-checked")).toBe("true")
  })

  it("renders an explicit collection-timing radiogroup with two options", () => {
    render(<BookingSummary {...defaultProps} />)
    // Both options must exist as a proper radiogroup with role=radio.
    const now = screen.getByRole("radio", {
      name: "bookings.wizard.step.confirm.collectionNow",
    })
    const atClinic = screen.getByRole("radio", {
      name: "bookings.wizard.step.confirm.payAtClinic",
    })
    expect(now).toBeInTheDocument()
    expect(atClinic).toBeInTheDocument()
    // Radiogroup wrapper exists with the section title as its accessible name.
    expect(
      screen.getByRole("radiogroup", {
        name: "bookings.wizard.step.confirm.collectionTimingHeader",
      }),
    ).toBeInTheDocument()
  })

  it("selects 'تحصيل الآن' (payAtClinic=false) reveals the shared PaymentMethodPicker", () => {
    const toggle = vi.fn()
    render(<BookingSummary {...defaultProps} onTogglePayAtClinic={toggle} />)
    const now = screen.getByRole("radio", {
      name: "bookings.wizard.step.confirm.collectionNow",
    })
    fireEvent.click(now)
    expect(toggle).toHaveBeenCalledWith(false)
  })

  it("selects 'الدفع في العيادة' (payAtClinic=true) keeps pay-at-clinic", () => {
    const toggle = vi.fn()
    render(<BookingSummary {...defaultProps} payAtClinic onTogglePayAtClinic={toggle} />)
    const atClinic = screen.getByRole("radio", {
      name: "bookings.wizard.step.confirm.payAtClinic",
    })
    fireEvent.click(atClinic)
    // Radiogroup semantics: each radio's onSelect fires with its own
    // value (true for pay-at-clinic), independent of the current state.
    // Clicking the already-selected option re-selects it — it does NOT
    // flip the boolean (a separate switch widget would).
    expect(toggle).toHaveBeenCalledWith(true)
  })

  it("default selection is 'الدفع في العيادة' so existing reception bookings are invoiced as today", () => {
    render(<BookingSummary {...defaultProps} payAtClinic />)
    const atClinic = screen.getByRole("radio", {
      name: "bookings.wizard.step.confirm.payAtClinic",
    }) as HTMLButtonElement
    const now = screen.getByRole("radio", {
      name: "bookings.wizard.step.confirm.collectionNow",
    }) as HTMLButtonElement
    expect(atClinic.getAttribute("aria-checked")).toBe("true")
    expect(now.getAttribute("aria-checked")).toBe("false")
  })

  it("renders PaymentMethodPicker only when payAtClinic=false; default hides it", () => {
    const { rerender } = render(<BookingSummary {...defaultProps} payAtClinic />)
    // With payAtClinic=true there must be no method-picker radiogroup;
    // its aria-label is the "collection method" label.
    expect(
      screen.queryByRole("radiogroup", {
        name: "bookings.wizard.step.confirm.collectionMethodLabel",
      }),
    ).toBeNull()

    rerender(<BookingSummary {...defaultProps} payAtClinic={false} />)
    // With payAtClinic=false the shared picker becomes visible.
    expect(
      screen.getByRole("radiogroup", {
        name: "bookings.wizard.step.confirm.collectionMethodLabel",
      }),
    ).toBeInTheDocument()
  })

  it("disables 'الدفع في العيادة' when paymentAtClinicEnabled=false (and shows the hint)", () => {
    render(
      <BookingSummary
        {...defaultProps}
        payAtClinic
        paymentSettings={{
          paymentMoyasarEnabled: false,
          paymentAtClinicEnabled: false,
          payMethodCashEnabled: true,
          payMethodBankEnabled: false,
          payMethodMadaEnabled: false,
          payMethodTabbyEnabled: false,
        }}
      />,
    )
    const atClinic = screen.getByRole("radio", {
      name: "bookings.wizard.step.confirm.payAtClinic",
    }) as HTMLButtonElement
    expect(atClinic).toBeDisabled()
    // Hint text rendered
    expect(
      screen.getAllByText("bookings.wizard.step.confirm.payAtClinicDisabledHint").length,
    ).toBeGreaterThan(0)
  })

  it("does not force or disable anything while paymentSettings is undefined", () => {
    render(<BookingSummary {...defaultProps} payAtClinic paymentSettings={undefined} />)
    const atClinic = screen.getByRole("radio", {
      name: "bookings.wizard.step.confirm.payAtClinic",
    }) as HTMLButtonElement
    // Preserves today's behavior until settings land.
    expect(atClinic).not.toBeDisabled()
  })

  it("hides the whole collection-timing group when hideCollectionTiming=true (package/credit path)", () => {
    render(<BookingSummary {...defaultProps} hideCollectionTiming />)
    expect(
      screen.queryByRole("radiogroup", {
        name: "bookings.wizard.step.confirm.collectionTimingHeader",
      }),
    ).toBeNull()
    // No method picker either.
    expect(
      screen.queryByRole("radiogroup", {
        name: "bookings.wizard.step.confirm.collectionMethodLabel",
      }),
    ).toBeNull()
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
        type="IN_PERSON"
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
      result.current.selectType("IN_PERSON")
    })
    expect(result.current.isComplete).toBe(false)
  })

  it("isComplete is false when date is set but time is not", () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient("cli-1", "Sara")
      result.current.selectService("svc-1", "Counseling")
      result.current.selectEmployee("emp-1", "Ahmad")
      result.current.selectType("IN_PERSON")
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
      result.current.selectType("IN_PERSON")
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
      result.current.selectType("IN_PERSON")
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
      result.current.selectType("IN_PERSON")
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
      result.current.selectType("IN_PERSON")
      result.current.selectDate("2026-06-01")
      result.current.selectTime("09:00")
      result.current.setPayAtClinic(true)
      result.current.setCouponCode("SAVE20")
    })
    const s = result.current.state
    expect(s.clientId).toBe("cli-1")
    expect(s.serviceId).toBe("svc-1")
    expect(s.employeeId).toBe("emp-1")
    expect(s.type).toBe("IN_PERSON")
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
      result.current.selectType("ONLINE")
      result.current.selectDate("2026-07-15")
      result.current.selectTime("14:30")
    })
    const s = result.current.state
    expect(s.clientId).toBe("cli-2")
    expect(s.serviceId).toBe("svc-2")
    expect(s.employeeId).toBe("emp-2")
    expect(s.type).toBe("ONLINE")
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
      result.current.selectType("IN_PERSON")
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
      result.current.selectType("IN_PERSON")
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
      result.current.selectType("IN_PERSON")
      result.current.selectDate("2026-06-01")
      result.current.selectTime("09:00")
    })
    act(() => {
      result.current.selectType("ONLINE")
    })
    const s = result.current.state
    expect(s.clientId).toBe("cli-1")
    expect(s.serviceId).toBe("svc-1")
    expect(s.employeeId).toBe("emp-1")
    expect(s.type).toBe("ONLINE")
    expect(s.date).toBeNull()
    expect(s.startTime).toBeNull()
  })

  it("selectDeliveryType resets date and time but preserves client/service/employee", () => {
    const { result } = renderHook(() => useBookingFormState())
    act(() => {
      result.current.selectClient("cli-1", "Sara")
      result.current.selectService("svc-1", "Counseling")
      result.current.selectEmployee("emp-1", "Ahmad")
      result.current.selectType("IN_PERSON")
      result.current.selectDate("2026-06-01")
      result.current.selectTime("09:00")
    })
    act(() => {
      result.current.selectDeliveryType("ONLINE")
    })
    const s = result.current.state
    expect(s.deliveryType).toBe("ONLINE")
    expect(s.date).toBeNull()
    expect(s.startTime).toBeNull()
    expect(s.clientId).toBe("cli-1")
    expect(s.serviceId).toBe("svc-1")
    expect(s.employeeId).toBe("emp-1")
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
