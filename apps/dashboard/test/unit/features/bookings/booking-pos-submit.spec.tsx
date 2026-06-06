/**
 * booking-pos-submit.spec.tsx
 *
 * Product-level BookingPos submit payload tests.
 *
 * Verifies that when the confirm button is clicked, the real handleSubmit
 * in BookingPos calls createMut.mutateAsync with the expected create-booking
 * DTO fields (clientId, serviceId, employeeId, type, date, startTime,
 * payAtClinic, couponCode, durationOptionId) — checked via toMatchObject
 * so additional fields beyond those listed do not cause test failure.
 *
 * Lives in its own file to avoid vi.mock hoisting conflicts with the
 * pure state-machine / BookingSummary tests in booking-create-flow.spec.tsx.
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { BookingPos } from "@/components/features/bookings/booking-pos"
import { useBookingFormState } from "@/components/features/bookings/use-booking-form-state"
import { useBookingMutations } from "@/hooks/use-bookings"

/* ─── Mocked locale ──────────────────────────────────────────────────────── */

vi.mock("@/components/locale-provider", () => ({
  useLocale: vi.fn(() => ({
    t: (k: string) => k,
    locale: "ar",
  })),
}))

vi.mock("@/hooks/use-organization-config", () => ({
  useOrganizationConfig: vi.fn(() => ({
    formatDate: (d: string) => d,
    formatTime: (t: string) => t,
  })),
}))

/* ─── Hugeicons stub ─────────────────────────────────────────────────────── */

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => null,
}))

/* ─── UI primitives — pass through real @sawaa/ui except Dialog (not used in submit path) ─── */

vi.mock("@sawaa/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@sawaa/ui")>()
  return {
    ...actual,
    Button:
      actual.Button ??
      (({
        children,
        disabled,
        className,
        ...props
      }: React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: string }) => (
        <button disabled={disabled} className={className} {...props}>
          {children}
        </button>
      )),
    Input:
      actual.Input ??
      (({
        value,
        onChange,
        placeholder,
        className,
        ...props
      }: React.InputHTMLAttributes<HTMLInputElement>) => (
        <input
          value={value ?? ""}
          onChange={onChange}
          placeholder={placeholder}
          className={className}
          {...props}
        />
      )),
    Tabs:
      actual.Tabs ??
      (({ children }: { children: React.ReactNode }) => <div>{children}</div>),
    TabsList:
      actual.TabsList ??
      (({ children }: { children: React.ReactNode }) => <div>{children}</div>),
    TabsTrigger:
      actual.TabsTrigger ??
      (({ children }: { children: React.ReactNode }) => <div>{children}</div>),
    TabsContent:
      actual.TabsContent ??
      (({ children }: { children: React.ReactNode }) => <div>{children}</div>),
    Dialog:
      actual.Dialog ??
      (({
        children,
        open,
        onOpenChange,
      }: {
        children: React.ReactNode
        open?: boolean
        onOpenChange?: (o: boolean) => void
      }) =>
        open ? (
          <div onClick={() => onOpenChange?.(false)}>{children}</div>
        ) : null),
    DialogContent: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    DialogHeader: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    Label:
      actual.Label ??
      (({ children }: { children: React.ReactNode }) => <div>{children}</div>),
    Textarea:
      actual.Textarea ??
      (({
        className,
        ...props
      }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
        <textarea className={className} {...props} />
      )),
    PhoneInput:
      actual.PhoneInput ??
      (({
        className,
        ...props
      }: React.InputHTMLAttributes<HTMLInputElement>) => (
        <input className={className} {...props} />
      )),
    Skeleton:
      actual.Skeleton ??
      (({ className }: { className?: string }) => (
        <div className={className} />
      )),
    Badge:
      actual.Badge ??
      (({
        children,
        className,
      }: {
        children: React.ReactNode
        className?: string
      }) => <div className={className}>{children}</div>),
    Avatar:
      actual.Avatar ??
      (({ children }: { children: React.ReactNode }) => <div>{children}</div>),
    AvatarFallback:
      actual.AvatarFallback ??
      (({ children }: { children: React.ReactNode }) => <div>{children}</div>),
    Sheet:
      actual.Sheet ??
      (({ children }: { children: React.ReactNode }) => <div>{children}</div>),
    SheetContent:
      actual.SheetContent ??
      (({ children }: { children: React.ReactNode }) => <div>{children}</div>),
  }
})

/* ─── FormattedCurrency stub ──────────────────────────────────────────────── */

vi.mock("@/components/features/shared/sar-symbol", () => ({
  FormattedCurrency: ({
    amount,
    className,
  }: {
    amount: number
    className?: string
  }) => <span className={className}>{amount}</span>,
}))

/* ─── Per-test complete form state ──────────────────────────────────────── */

const makeCompleteState = (overrides = {}) => ({
  state: {
    clientId: "cli-1",
    clientName: "Sara",
    departmentId: "dep-1",
    departmentName: "Family",
    categoryId: "cat-1",
    categoryName: "Marriage Clinic",
    serviceId: "svc-1",
    serviceName: "Counseling",
    employeeId: "emp-1",
    employeeName: "Ahmad",
    deliveryType: "in_person" as const,
    type: "in_person" as const,
    durationOptionId: null,
    durationLabel: null,
    date: "2026-06-01",
    startTime: "09:00",
    payAtClinic: false,
    couponCode: null,
    ...overrides,
  },
  isComplete: true,
  reset: vi.fn(),
  selectClient: vi.fn(),
  selectDepartment: vi.fn(),
  selectCategory: vi.fn(),
  selectService: vi.fn(),
  selectEmployee: vi.fn(),
  selectDeliveryType: vi.fn(),
  selectType: vi.fn(),
  selectDuration: vi.fn(),
  skipDuration: vi.fn(),
  selectDate: vi.fn(),
  selectTime: vi.fn(),
  setPayAtClinic: vi.fn(),
  setCouponCode: vi.fn(),
})

/* ─── Shared mock factories ──────────────────────────────────────────────── */

const { createMut } = vi.hoisted(() => ({
  createMut: {
    mutateAsync: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    isPending: false,
  },
}))

vi.mock("@/hooks/use-bookings", () => ({
  useBookingMutations: vi.fn(() => ({ createMut })),
}))

vi.mock("@/components/features/bookings/use-booking-form-state", () => ({
  useBookingFormState: vi.fn(() => makeCompleteState()),
}))

vi.mock("@/hooks/use-branches", () => ({
  useBranches: vi.fn(() => ({ branches: [{ id: "branch-1", isMain: true }] })),
}))

vi.mock("@/hooks/use-organization-settings", () => ({
  useBookingSettings: vi.fn(() => ({ data: { maxAdvanceBookingDays: 90 } })),
}))

vi.mock("@/lib/api/services", () => ({
  fetchServices: vi.fn(() =>
    Promise.resolve({ items: [{ id: "svc-1", price: 15000 }] })
  ),
}))

/* ─── Renderer ───────────────────────────────────────────────────────────── */

function renderBookingPos(formState = makeCompleteState()) {
  vi.mocked(useBookingFormState).mockReturnValue(
    formState as ReturnType<typeof useBookingFormState>
  )

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
  return render(<BookingPos onSuccess={vi.fn()} onCancel={vi.fn()} />, {
    wrapper: Wrapper,
  })
}

/* ══════════════════════════════════════════════════════════════════════════
   BookingPos submit payload tests
   ══════════════════════════════════════════════════════════════════════════ */

describe("BookingPos — real handleSubmit → createMut.mutateAsync payload", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createMut.mutateAsync.mockResolvedValue({ id: "bk-new" })
  })

  it("confirm button click calls createMut.mutateAsync with all required payload fields", async () => {
    renderBookingPos()

    fireEvent.click(
      screen.getByRole("button", { name: /bookings\.pos\.confirm/ })
    )

    await waitFor(() => {
      expect(createMut.mutateAsync).toHaveBeenCalledTimes(1)
    })

    const [payload] = createMut.mutateAsync.mock.calls[0] as [
      Record<string, unknown>,
    ]
    expect(payload).toMatchObject({
      clientId: "cli-1",
      serviceId: "svc-1",
      employeeId: "emp-1",
      type: "individual",
      deliveryType: "in_person",
      date: "2026-06-01",
      startTime: "09:00",
      payAtClinic: false,
    })
  })

  it("submit payload includes couponCode when a coupon is set", async () => {
    renderBookingPos(makeCompleteState({ couponCode: "SAVE20" }))

    fireEvent.click(
      screen.getByRole("button", { name: /bookings\.pos\.confirm/ })
    )

    await waitFor(() => {
      expect(createMut.mutateAsync).toHaveBeenCalledTimes(1)
    })

    const [payload] = createMut.mutateAsync.mock.calls[0] as [
      Record<string, unknown>,
    ]
    expect(payload).toMatchObject({ couponCode: "SAVE20" })
  })

  it("submit payload includes payAtClinic: true when toggled", async () => {
    renderBookingPos(makeCompleteState({ payAtClinic: true }))

    fireEvent.click(
      screen.getByRole("button", { name: /bookings\.pos\.confirm/ })
    )

    await waitFor(() => {
      expect(createMut.mutateAsync).toHaveBeenCalledTimes(1)
    })

    const [payload] = createMut.mutateAsync.mock.calls[0] as [
      Record<string, unknown>,
    ]
    expect(payload).toMatchObject({ payAtClinic: true })
  })

  it("submit payload includes durationOptionId when a duration is selected", async () => {
    renderBookingPos(
      makeCompleteState({
        durationOptionId: "dur-45",
        durationLabel: "45 دقيقة",
      })
    )

    fireEvent.click(
      screen.getByRole("button", { name: /bookings\.pos\.confirm/ })
    )

    await waitFor(() => {
      expect(createMut.mutateAsync).toHaveBeenCalledTimes(1)
    })

    const [payload] = createMut.mutateAsync.mock.calls[0] as [
      Record<string, unknown>,
    ]
    expect(payload).toMatchObject({ durationOptionId: "dur-45" })
  })

  it("submit button is disabled while mutation is pending", () => {
    const pendingMut: typeof createMut & { isPending: true } = {
      ...createMut,
      isPending: true,
    }
    vi.mocked(useBookingMutations).mockReturnValueOnce({
      createMut: pendingMut,
    } as unknown as ReturnType<typeof useBookingMutations>)

    renderBookingPos()

    const btn = screen.getByRole("button", {
      name: /bookings\.pos\.confirm/,
    }) as HTMLButtonElement
    expect(btn).toBeDisabled()
  })
})
