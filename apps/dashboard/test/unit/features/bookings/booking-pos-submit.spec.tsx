/**
 * booking-pos-submit.spec.tsx
 *
 * Product-level BookingPos submit payload tests.
 *
 * Verifies that when the confirm button is clicked, the real handleSubmit
 * in BookingPos calls createMut.mutateAsync with the expected create-booking
 * DTO fields (clientId, serviceId, employeeId, type, deliveryType, date,
 * startTime, payAtClinic, couponCode) — checked via toMatchObject so
 * additional fields beyond those listed do not cause test failure.
 *
 * Note: the POS flow derives session duration from service bookingConfigs,
 * not a user-selected durationOptionId, so no durationOptionId is sent.
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

const { toastError, toastSuccess } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}))

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
    track: "CLINICS" as const,
    departmentId: "dep-1",
    departmentName: "Family",
    categoryId: "cat-1",
    categoryName: "Marriage Clinic",
    categoryBookingMode: "SERVICES" as const,
    serviceId: "svc-1",
    serviceName: "Counseling",
    employeeId: "emp-1",
    employeeName: "Ahmad",
    durationOptionId: null,
    deliveryType: "IN_PERSON" as const,
    type: "IN_PERSON" as const,
    date: "2026-06-01",
    startTime: "09:00",
    programId: null,
    programName: null,
    packagePurchaseId: null,
    payAtClinic: false,
    collectionMethod: "CASH" as const,
    couponCode: null,
    ...overrides,
  },
  isComplete: true,
  reset: vi.fn(),
  selectClient: vi.fn(),
  selectTrack: vi.fn(),
  selectDepartment: vi.fn(),
  selectCategory: vi.fn(),
  selectService: vi.fn(),
  selectEmployee: vi.fn(),
  selectDeliveryType: vi.fn(),
  selectType: vi.fn(),
  selectDurationOption: vi.fn(),
  selectDate: vi.fn(),
  selectTime: vi.fn(),
  selectProgram: vi.fn(),
  setPayAtClinic: vi.fn(),
  setCollectionMethod: vi.fn(),
  setCouponCode: vi.fn(),
  applyCreditTarget: vi.fn(),
  applyPackageCreditTarget: vi.fn(),
})

/* ─── Shared mock factories ──────────────────────────────────────────────── */

const { createMut, ensureInvoiceMut, recordMut, bookFromCreditMut } = vi.hoisted(() => ({
  createMut: {
    mutateAsync: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    isPending: false,
  },
  ensureInvoiceMut: {
    mutateAsync: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    isPending: false,
  },
  recordMut: {
    mutateAsync: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    isPending: false,
  },
  bookFromCreditMut: {
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
  // `undefined` data signals "still loading" — use-booking-pos-submit
  // must NOT force payAtClinic in that case (see booking-pos.tsx comment).
  usePaymentSettings: vi.fn(() => ({ data: undefined })),
}))

vi.mock("@/hooks/use-payments", () => ({
  useRecordPaymentMutations: vi.fn(() => ({ recordMut, ensureInvoiceMut })),
}))

vi.mock("@/hooks/use-credit-bookings", () => ({
  useBookFromCredit: vi.fn(() => bookFromCreditMut),
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
    // Default collect-now sequence returns a zero-outstanding invoice so
    // the W2-T2 PAID branch in use-booking-pos-submit completes without
    // firing the paymentRecordFailed toast. Tests that want to exercise
    // the recordPayment path can override this in `mockResolvedValueOnce`.
    ensureInvoiceMut.mutateAsync.mockResolvedValue({ id: "inv-stub", outstanding: 0 })
    recordMut.mutateAsync.mockResolvedValue({ id: "pay-stub" })
    bookFromCreditMut.mutateAsync.mockResolvedValue({ id: "bk-credit" })
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
      deliveryType: "IN_PERSON",
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

  it("normalizes backend uppercase deliveryType (IN_PERSON) to lowercase so the POS payload validates", async () => {
    // Regression: the backend serviceTypes API returns deliveryType as
    // "IN_PERSON"/"ONLINE" (uppercase) and the wizard stores it verbatim,
    // but bookingPosPayloadSchema expects lowercase. Without normalization
    // the payload fails runtime validation and no booking is ever created.
    renderBookingPos(
      makeCompleteState({
        deliveryType: "IN_PERSON" as unknown as "IN_PERSON",
      })
    )

    fireEvent.click(
      screen.getByRole("button", { name: /bookings\.pos\.confirm/ })
    )

    await waitFor(() => {
      expect(createMut.mutateAsync).toHaveBeenCalledTimes(1)
    })
    expect(toastError).not.toHaveBeenCalled()

    const [payload] = createMut.mutateAsync.mock.calls[0] as [
      Record<string, unknown>,
    ]
    expect(payload).toMatchObject({ deliveryType: "IN_PERSON" })
  })

  it("does not call create mutation when the POS payload fails runtime validation", async () => {
    renderBookingPos(
      makeCompleteState({
        deliveryType: "home_visit",
        type: "home_visit",
      })
    )

    fireEvent.click(
      screen.getByRole("button", { name: /bookings\.pos\.confirm/ })
    )

    await waitFor(() => {
      expect(toastError).toHaveBeenCalled()
    })
    expect(createMut.mutateAsync).not.toHaveBeenCalled()
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
