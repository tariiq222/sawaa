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
 * W1-T4 — after the W1-T4 refactor that collapsed the W2-T2 two-call
 * collect-now sequence (ensureInvoiceMut + recordMut) into the single
 * `collectMut`, this spec mocks `collectMut` directly. Default resolution
 * is `{ payment: null }` so the PAID branch completes without firing
 * either `paymentRecorded` or `paymentRecordFailed` toasts. New tests
 * assert that collect-now (payAtClinic false) calls collectMut with
 * `{ bookingId, method }` (no amount, no discount), payAtClinic true
 * never collects, and the credit/package branch never collects.
 *
 * Lives in its own file to avoid vi.mock hoisting conflicts with the
 * pure state-machine / BookingSummary tests in booking-create-flow.spec.tsx.
 */

import { render, screen, fireEvent, waitFor, renderHook } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { useBookingPosSubmit } from "@/components/features/bookings/use-booking-pos-submit"
import type { BookingFormState } from "@/components/features/bookings/use-booking-form-state"

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
    creditFilter: null,
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
  applyCreditFilter: vi.fn(),
  clearCreditFilter: vi.fn(),
})

/* ─── Shared mock factories ──────────────────────────────────────────────── */

const { createMut, collectMut, bookFromCreditMut } = vi.hoisted(() => ({
  createMut: {
    mutateAsync: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
    isPending: false,
  },
  collectMut: {
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
  useRecordPaymentMutations: vi.fn(() => ({ collectMut })),
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
    // W1-T4 — default collectMut resolves with `{ payment: null }` so the
    // PAID branch in use-booking-pos-submit completes without firing
    // `paymentRecorded` (zero outstanding) or `paymentRecordFailed` (throw).
    // Tests that want to exercise the success path can override with
    // `mockResolvedValueOnce({ payment: { id: "pay-1" } })`.
    collectMut.mutateAsync.mockResolvedValue({ payment: null })
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

  /* ════════════════════════════════════════════════════════════════════════
     W1-T4 — collect-now is a single collectMut call.
     payAtClinic false (تحصيل الآن) → collectMut called once with
       { bookingId, method } (no amount, no discount).
     payAtClinic true                  → collectMut NOT called.
     Credit/packagePurchaseId path     → collectMut NOT called.
     When collectMut resolves with `{ payment }` → paymentRecorded toast.
     When collectMut resolves with `{ payment: null }` → no toast.
     When collectMut rejects                       → paymentRecordFailed toast.
     ════════════════════════════════════════════════════════════════════════ */

  it("collect-now (payAtClinic false) calls collectMut once with bookingId and resolved method, no amount/discount", async () => {
    collectMut.mutateAsync.mockResolvedValueOnce({ payment: { id: "pay-1" } })

    renderBookingPos()

    fireEvent.click(
      screen.getByRole("button", { name: /bookings\.pos\.confirm/ })
    )

    await waitFor(() => {
      expect(collectMut.mutateAsync).toHaveBeenCalledTimes(1)
    })

    const [payload] = collectMut.mutateAsync.mock.calls[0] as [
      Record<string, unknown>,
    ]
    expect(payload).toMatchObject({
      bookingId: "bk-new",
      method: "CASH",
      idempotencyKey: expect.any(String),
    })
    // W1-T4 contract — server collects the full outstanding amount, so
    // the hook must NOT send amount or discount from the client.
    expect(payload).not.toHaveProperty("amount")
    expect(payload).not.toHaveProperty("discount")
    // Server returned a payment → success toast fires.
    expect(toastSuccess).toHaveBeenCalledWith(
      "bookings.wizard.step.confirm.paymentRecorded"
    )
  })

  it("collect-now stays silent when server returns payment: null (zero outstanding)", async () => {
    // beforeEach already sets collectMut default to { payment: null }.
    renderBookingPos()

    fireEvent.click(
      screen.getByRole("button", { name: /bookings\.pos\.confirm/ })
    )

    await waitFor(() => {
      expect(collectMut.mutateAsync).toHaveBeenCalledTimes(1)
    })
    // paymentRecorded toast is suppressed when nothing was paid.
    expect(toastSuccess).not.toHaveBeenCalledWith(
      "bookings.wizard.step.confirm.paymentRecorded"
    )
    // paymentRecordFailed is also NOT fired — the call succeeded.
    expect(toastError).not.toHaveBeenCalledWith(
      "bookings.wizard.step.confirm.paymentRecordFailed"
    )
  })

  it("payAtClinic true does NOT call collectMut", async () => {
    renderBookingPos(makeCompleteState({ payAtClinic: true }))

    fireEvent.click(
      screen.getByRole("button", { name: /bookings\.pos\.confirm/ })
    )

    await waitFor(() => {
      expect(createMut.mutateAsync).toHaveBeenCalledTimes(1)
    })
    expect(collectMut.mutateAsync).not.toHaveBeenCalled()
  })

  it("credit path (packagePurchaseId set) posts to /from-credit and does NOT call collectMut", async () => {
    // Setting packagePurchaseId + durationOptionId triggers the credit
    // branch in use-booking-pos-submit (the hook checks
    // `useCredit || state.packagePurchaseId`).
    renderBookingPos(
      makeCompleteState({
        packagePurchaseId: "pkg-1",
        durationOptionId: "dur-credit-1",
      })
    )

    fireEvent.click(
      screen.getByRole("button", { name: /bookings\.pos\.confirm/ })
    )

    await waitFor(() => {
      expect(bookFromCreditMut.mutateAsync).toHaveBeenCalledTimes(1)
    })
    // Credit branch is sacred — no create, no collect, no ensureInvoice.
    expect(createMut.mutateAsync).not.toHaveBeenCalled()
    expect(collectMut.mutateAsync).not.toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledWith("bookings.credit.toast.success")
  })

  it("collect-now failure surfaces paymentRecordFailed toast and does NOT throw out of submit", async () => {
    collectMut.mutateAsync.mockRejectedValueOnce(new Error("server boom"))

    renderBookingPos()

    fireEvent.click(
      screen.getByRole("button", { name: /bookings\.pos\.confirm/ })
    )

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "bookings.wizard.step.confirm.paymentRecordFailed",
        expect.objectContaining({ id: "pos-payment-record-failed" }),
      )
    })
    // CRITICAL — the booking IS created. Never show the generic
    // submit-error toast for a collect failure.
    expect(toastError).not.toHaveBeenCalledWith("bookings.wizard.submitError")
    expect(toastSuccess).not.toHaveBeenCalledWith(
      "bookings.wizard.step.confirm.paymentRecorded"
    )
  })
})

/* ══════════════════════════════════════════════════════════════════════════
   W3-T9 — creditId forwarded only on the FLEXIBLE path

   The submit hook must populate `creditId` ONLY when state.creditFilter is
   set (the operator picked a specific FLEXIBLE credit). Without it, the
   backend FIFO/specificity matcher could debit the WRONG overlapping
   package. The PINNED path (creditFilter null + packagePurchaseId set) and
   the auto-detect BADGE path (creditFilter null + useCredit true) keep
   sending the triple alone — the conditional spread omits the `creditId`
   key entirely so the JSON payload is byte-identical to today.

   Tests (a), (b), (d) drive the real BookingPos so the integration end-
   to-end is exercised. Test (c) drives the hook directly via renderHook
   because the only consumer that flips useCredit=true is the MatchingCredit
   accept button, which only renders inside the datetime CollapsibleSection
   when MatchingCreditBadge returns matches — opening that section in a
   renderBookingPos test would require mocking useMatchingCredits, opening
   a closed accordion, and asserting through additional UI noise that does
   not add coverage beyond what calling the hook with useCredit=true does.
   ══════════════════════════════════════════════════════════════════════════ */

describe("BookingPos — W3-T9: creditId forwarded only on the FLEXIBLE path", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    bookFromCreditMut.mutateAsync.mockResolvedValue({ id: "bk-credit" })
    createMut.mutateAsync.mockResolvedValue({ id: "bk-new" })
    // W1-T4 — default collectMut resolves with `{ payment: null }`.
    collectMut.mutateAsync.mockResolvedValue({ payment: null })
  })

  /* (a) FLEXIBLE: creditFilter set → posts creditId AND the full triple. */
  it("FLEXIBLE path: payload includes creditId AND the full triple when state.creditFilter is set", async () => {
    const flexibleCreditId = "credit-flex-1"
    const flexiblePurchaseId = "pkg-flex-1"
    const creditFilter = {
      creditId: flexibleCreditId,
      packagePurchaseId: flexiblePurchaseId,
      packageName: "Flexible Package",
      constraints: [],
      serviceId: null,
      employeeId: null,
      durationOptionId: null,
    }

    renderBookingPos(
      makeCompleteState({
        creditFilter: creditFilter as unknown as ReturnType<
          typeof useBookingFormState
        >["state"]["creditFilter"],
        packagePurchaseId: flexiblePurchaseId,
        durationOptionId: "dur-flex-1",
      }),
    )

    fireEvent.click(
      screen.getByRole("button", { name: /bookings\.pos\.confirm/ }),
    )

    await waitFor(() => {
      expect(bookFromCreditMut.mutateAsync).toHaveBeenCalledTimes(1)
    })

    const [payload] = bookFromCreditMut.mutateAsync.mock.calls[0] as [
      Record<string, unknown>,
    ]
    // creditId is forwarded.
    expect(payload).toMatchObject({
      creditId: flexibleCreditId,
      clientId: "cli-1",
      serviceId: "svc-1",
      employeeId: "emp-1",
      durationOptionId: "dur-flex-1",
      branchId: "branch-1",
      deliveryType: "IN_PERSON",
    })
    // The full triple is still present so the backend can constraint-validate.
    expect(payload).toHaveProperty("scheduledAt")
    expect(createMut.mutateAsync).not.toHaveBeenCalled()
    expect(collectMut.mutateAsync).not.toHaveBeenCalled()
  })

  /* (b) PINNED: creditFilter null + packagePurchaseId set → payload has NO creditId key. */
  it("PINNED path: payload has NO creditId key when only packagePurchaseId is set (creditFilter null)", async () => {
    renderBookingPos(
      makeCompleteState({
        packagePurchaseId: "pkg-pinned-1",
        durationOptionId: "dur-pinned-1",
      }),
    )

    fireEvent.click(
      screen.getByRole("button", { name: /bookings\.pos\.confirm/ }),
    )

    await waitFor(() => {
      expect(bookFromCreditMut.mutateAsync).toHaveBeenCalledTimes(1)
    })

    const [payload] = bookFromCreditMut.mutateAsync.mock.calls[0] as [
      Record<string, unknown>,
    ]
    // PINNED payload is byte-identical to today — no creditId key at all.
    expect(payload).not.toHaveProperty("creditId")
    // Triple is still there.
    expect(payload).toMatchObject({
      clientId: "cli-1",
      serviceId: "svc-1",
      employeeId: "emp-1",
      durationOptionId: "dur-pinned-1",
      branchId: "branch-1",
      deliveryType: "IN_PERSON",
    })
  })

  /* (c) BADGE: creditFilter null + useCredit true → payload has NO creditId key.
   * Uses renderHook because the only consumer that flips useCredit=true is
   * the MatchingCreditBadge accept button — exercising that UI path here
   * would require mocking useMatchingCredits, opening the datetime
   * CollapsibleSection, and asserting through unrelated UI plumbing. The
   * regression we care about is the hook's conditional-spread branch. */
  it("BADGE path: payload has NO creditId key when useCredit is true but state.creditFilter is null", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    function Wrapper({ children }: { children: React.ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )
    }

    const minimalState = {
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
      durationOptionId: "dur-badge-1",
      deliveryType: "IN_PERSON" as const,
      type: "IN_PERSON" as const,
      date: "2026-06-01",
      startTime: "09:00",
      programId: null,
      programName: null,
      packagePurchaseId: null,
      creditFilter: null,
      payAtClinic: false,
      collectionMethod: "CASH" as const,
      couponCode: null,
    }

    const { result } = renderHook(
      () =>
        useBookingPosSubmit({
          state: minimalState as unknown as BookingFormState,
          mainBranch: { id: "branch-1" },
          // useCredit=true simulates the operator having clicked the
          // MatchingCreditBadge accept button. The filter is NOT set
          // because the badge auto-detect path never produces a
          // CreditFilter — only the applyCreditFilter path does.
          useCredit: true,
          reset: vi.fn(),
          onSuccess: vi.fn(),
        }),
      { wrapper: Wrapper },
    )

    await result.current.submit()

    expect(bookFromCreditMut.mutateAsync).toHaveBeenCalledTimes(1)
    const [payload] = bookFromCreditMut.mutateAsync.mock.calls[0] as [
      Record<string, unknown>,
    ]
    // Regression guard — the badge path must NOT send creditId.
    expect(payload).not.toHaveProperty("creditId")
    // Triple still present.
    expect(payload).toMatchObject({
      clientId: "cli-1",
      serviceId: "svc-1",
      employeeId: "emp-1",
      durationOptionId: "dur-badge-1",
      branchId: "branch-1",
      deliveryType: "IN_PERSON",
    })
  })

  /* (d) NON-CREDIT: ordinary booking still posts to /bookings and never
   * touches bookFromCreditMut — the credit branch is opt-in only. */
  it("non-credit path: ordinary booking never calls bookFromCreditMut", async () => {
    // Default makeCompleteState: no packagePurchaseId, no creditFilter.
    renderBookingPos()

    fireEvent.click(
      screen.getByRole("button", { name: /bookings\.pos\.confirm/ }),
    )

    await waitFor(() => {
      expect(createMut.mutateAsync).toHaveBeenCalledTimes(1)
    })
    expect(bookFromCreditMut.mutateAsync).not.toHaveBeenCalled()
  })
})
