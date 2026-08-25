/**
 * step-package.spec.tsx
 *
 * Unit tests for the PACKAGES-track wizard step container
 * (`StepPackage`). Covers:
 *
 *   a. With `onFlexibleCreditSelected` provided and the client holding
 *      a single FLEXIBLE credit: the flexible button is ENABLED, and a
 *      click calls the callback exactly once with a `CreditFilter` whose
 *      `packagePurchaseId`, `creditId`, `packageName`, and `constraints`
 *      all match the source credit and purchase.
 *   b. With `onFlexibleCreditSelected` OMITTED and the same data: the
 *      flexible button is DISABLED (absent-callback fallback) and no
 *      callback fires.
 *   c. A PINNED bookable credit still calls `onCreditSelected` with a
 *      full `CreditTarget` AND does NOT call `onFlexibleCreditSelected`.
 *   d. A client holding ONLY flexible credits still opens the step in
 *      EXISTING mode (regression guard for the EXISTING-mode resolver
 *      that counts any credit with `remaining > 0`).
 *
 * Mirrors the locale-stub style of `package-credit-picker.spec.tsx` (the
 * `t()` stub returns the key verbatim) and the hook-mock style of
 * `client-credits-panel.test.tsx` (vi.fn() factory with mockReturnValue).
 */

import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { vi, test, expect, beforeEach } from "vitest"

/* ─── Locale stub (verbatim-key return) ─── */

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    t: (k: string) => k,
    locale: "ar",
  }),
}))

/* ─── UI primitives stub (real @sawaa/ui is fine but keep Button simple) ─── */

vi.mock("@sawaa/ui", () => {
  const Button = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: string; variant?: string; disabled?: boolean }
  >(({ children, onClick, disabled, ...props }, ref) => (
    <button ref={ref} onClick={onClick} disabled={disabled} aria-label={typeof children === "string" ? children : undefined} {...props}>
      {children}
    </button>
  ))
  Button.displayName = "Button"
  return { Button }
})

/* ─── Hugeicons stub ─── */

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => null,
}))

/* ─── Hook mocks (factory pattern, see client-credits-panel.test.tsx) ─── */

vi.mock("@/hooks/use-package-purchases", () => ({
  useClientPackagePurchases: vi.fn(),
  useSellPackage: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  })),
}))

vi.mock("@/hooks/use-packages", () => ({
  usePackagesList: vi.fn(() => ({
    packages: [],
    meta: null,
    isLoading: false,
    error: null,
    page: 1,
    setPage: vi.fn(),
    search: "",
    setSearch: vi.fn(),
    isActive: undefined,
    setIsActive: vi.fn(),
    resetFilters: vi.fn(),
    refetch: vi.fn(),
  })),
}))

vi.mock("@/hooks/use-organization-settings", () => ({
  usePaymentSettings: vi.fn(() => ({ data: undefined })),
}))

/* ─── Subject under test (import AFTER mocks so vi.mock hoisting applies) ─── */

import { StepPackage } from "@/components/features/bookings/wizard-steps/step-package"
import { useClientPackagePurchases } from "@/hooks/use-package-purchases"
import type {
  PackageCredit,
  PackagePurchase,
} from "@/lib/types/package-purchase"

const mockUseClientPackagePurchases = vi.mocked(useClientPackagePurchases)

/* ─── Shared fixtures ─── */

const PINNED_JUMPABLE: PackageCredit = {
  id: "cr-pinned",
  serviceId: "s-1",
  employeeId: "e-1",
  durationOptionId: "d-1",
  serviceNameAr: "استشارة أسرية",
  serviceNameEn: "Family Counseling",
  employeeNameAr: "أحمد",
  employeeNameEn: "Ahmad",
  durationLabelAr: "٤٥ دقيقة",
  durationLabelEn: "45 min",
  durationMins: 45,
  unitPriceSnapshot: 10000,
  totalQuantity: 4,
  usedQuantity: 1,
  remaining: 3,
  categoryId: "cat-1",
  categoryNameAr: "عيادة",
  categoryNameEn: "Clinic",
  categoryBookingMode: "SERVICES",
  departmentId: "dep-1",
  departmentNameAr: "قسم",
  departmentNameEn: "Department",
  serviceIsBookable: true,
  // A non-empty constraint array — chosen so the flexible-credit test
  // below can assert that the constraints pass through unchanged.
  constraints: [
    { dimension: "SERVICE", mode: "INCLUDE", targetIds: ["s-1", "s-2"] },
    { dimension: "PRACTITIONER", mode: "EXCLUDE", targetIds: ["e-99"] },
  ],
}

const FLEXIBLE_CREDIT: PackageCredit = {
  // Truly flexible — all four resolved ids null, no legacy triple,
  // service marked un-bookable. Non-empty constraints prove the filter
  // carries them through.
  id: "cr-flex",
  serviceId: null,
  employeeId: null,
  durationOptionId: null,
  serviceNameAr: "",
  serviceNameEn: null,
  employeeNameAr: "",
  employeeNameEn: null,
  durationLabelAr: "",
  durationLabelEn: null,
  durationMins: null,
  unitPriceSnapshot: 10000,
  totalQuantity: 2,
  usedQuantity: 0,
  remaining: 2,
  categoryId: null,
  categoryNameAr: "",
  categoryNameEn: null,
  categoryBookingMode: null,
  departmentId: null,
  departmentNameAr: "",
  departmentNameEn: null,
  serviceIsBookable: false,
  constraints: [
    { dimension: "SERVICE", mode: "INCLUDE", targetIds: ["svc-A", "svc-B"] },
    { dimension: "DELIVERY_TYPE", mode: "INCLUDE", targetIds: ["IN_PERSON"] },
  ],
}

const PURCHASE_PINNED: PackagePurchase = {
  id: "p-pinned",
  packageId: "pkg-1",
  packageNameAr: "باقة مثبتة",
  packageNameEn: "Pinned package",
  status: "ACTIVE",
  subtotalSnapshot: 0,
  discountSnapshot: 0,
  amountPaid: 0,
  refundAmount: 0,
  paidAt: "2026-01-01T00:00:00.000Z",
  refundedAt: null,
  notes: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  credits: [PINNED_JUMPABLE],
}

const PURCHASE_FLEXIBLE: PackagePurchase = {
  ...PURCHASE_PINNED,
  id: "p-flex",
  packageNameAr: "باقة مرنة",
  packageNameEn: "Flexible package",
  credits: [FLEXIBLE_CREDIT],
}

/* ─── Renderer ─── */

function renderStep(props: {
  onCreditSelected?: (target: import("@/components/features/bookings/use-booking-form-state").CreditTarget, packagePurchaseId: string) => void
  onFlexibleCreditSelected?: (filter: import("@/lib/booking-credit-filter").CreditFilter) => void
  purchases: PackagePurchase[]
}) {
  const onCreditSelected = props.onCreditSelected ?? vi.fn()
  const onFlexibleCreditSelected = props.onFlexibleCreditSelected
  mockUseClientPackagePurchases.mockReturnValue({
    data: props.purchases,
    isLoading: false,
  } as ReturnType<typeof useClientPackagePurchases>)

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  const allProps: React.ComponentProps<typeof StepPackage> = {
    clientId: "c-1",
    branchId: "b-1",
    onCreditSelected,
    ...(onFlexibleCreditSelected
      ? { onFlexibleCreditSelected }
      : {}),
  }
  return {
    ...render(<StepPackage {...allProps} />, { wrapper }),
    onCreditSelected,
    onFlexibleCreditSelected,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

/* ─── (a) Flexible branch ENABLED when wired ─── */

test("flexible credit: enabled button calls onFlexibleCreditSelected with a CreditFilter mirroring source credit + purchase", async () => {
  const onCreditSelected = vi.fn()
  const onFlexibleCreditSelected = vi.fn()
  const user = userEvent.setup()

  renderStep({
    onCreditSelected,
    onFlexibleCreditSelected,
    purchases: [PURCHASE_FLEXIBLE],
  })

  // The step opens in EXISTING mode because hasUsableCredits is true
  // (flexible credits with remaining > 0 count). The flexible button
  // must be ENABLED because onFlexibleCreditSelected was passed down.
  const flexibleBtn = screen.getByRole("button", {
    name: /bookings\.pos\.package\.chooseFromPackage/,
  })
  expect(flexibleBtn).not.toBeDisabled()

  await user.click(flexibleBtn)

  expect(onFlexibleCreditSelected).toHaveBeenCalledTimes(1)
  expect(onCreditSelected).not.toHaveBeenCalled()

  const [filter] = onFlexibleCreditSelected.mock.calls[0]
  expect(filter).toEqual(
    expect.objectContaining({
      packagePurchaseId: PURCHASE_FLEXIBLE.id,
      creditId: FLEXIBLE_CREDIT.id,
      packageName: PURCHASE_FLEXIBLE.packageNameAr,
      constraints: FLEXIBLE_CREDIT.constraints,
    }),
  )
  // Legacy triple members are normalised to null on a truly flexible
  // credit, regardless of how the caller modelled them.
  expect(filter.serviceId).toBeNull()
  expect(filter.employeeId).toBeNull()
  expect(filter.durationOptionId).toBeNull()
})

/* ─── (b) Flexible branch DISABLED when NOT wired ─── */

test("flexible credit with no onFlexibleCreditSelected prop renders disabled (absent-callback fallback)", async () => {
  const onCreditSelected = vi.fn()
  const user = userEvent.setup()

  renderStep({
    onCreditSelected,
    // onFlexibleCreditSelected omitted on purpose
    purchases: [PURCHASE_FLEXIBLE],
  })

  const flexibleBtn = screen.getByRole("button", {
    name: /bookings\.pos\.package\.chooseFromPackage/,
  })
  expect(flexibleBtn).toBeDisabled()

  // Clicking a disabled button must NOT fire any callback (the picker
  // guards both onPick and onPickFlexible behind the disabled flag).
  await user.click(flexibleBtn)
  expect(onCreditSelected).not.toHaveBeenCalled()
})

/* ─── (c) PINNED bookable credit: still calls onCreditSelected ─── */

test("pinned bookable credit: calls onCreditSelected with a CreditTarget, NOT onFlexibleCreditSelected", async () => {
  const onCreditSelected = vi.fn()
  const onFlexibleCreditSelected = vi.fn()
  const user = userEvent.setup()

  renderStep({
    onCreditSelected,
    onFlexibleCreditSelected,
    purchases: [PURCHASE_PINNED],
  })

  const useBtn = screen.getByRole("button", {
    name: /bookings\.pos\.package\.use/,
  })
  expect(useBtn).not.toBeDisabled()

  await user.click(useBtn)

  expect(onCreditSelected).toHaveBeenCalledTimes(1)
  expect(onFlexibleCreditSelected).not.toHaveBeenCalled()

  const [target, packagePurchaseId] = onCreditSelected.mock.calls[0]
  expect(packagePurchaseId).toBe(PURCHASE_PINNED.id)
  // Every CreditTarget id field must be a non-empty string (the picker
  // narrows via `isJumpableCredit` before building the target).
  expect(typeof target.categoryId).toBe("string")
  expect(target.categoryId.length).toBeGreaterThan(0)
  expect(typeof target.serviceId).toBe("string")
  expect(target.serviceId.length).toBeGreaterThan(0)
  expect(typeof target.employeeId).toBe("string")
  expect(target.employeeId.length).toBeGreaterThan(0)
  expect(typeof target.durationOptionId).toBe("string")
  expect(target.durationOptionId.length).toBeGreaterThan(0)
})

/* ─── (d) EXISTING-mode regression guard ─── */

test("client holding ONLY flexible credits still opens the step in EXISTING mode (not BUY)", () => {
  // hasUsableCredits counts flexible credits (categoryId === null) too,
  // so the step must auto-resolve to EXISTING. Otherwise the operator
  // would be invited to sell a duplicate package to a client who
  // already has unused rule-based credits.
  const onCreditSelected = vi.fn()
  const onFlexibleCreditSelected = vi.fn()

  renderStep({
    onCreditSelected,
    onFlexibleCreditSelected,
    purchases: [PURCHASE_FLEXIBLE],
  })

  // EXISTING mode heading — proves the resolver picked EXISTING, not BUY.
  expect(
    screen.getByText(/bookings\.pos\.package\.existing\.title/),
  ).toBeInTheDocument()
  // BUY-mode catalog heading must NOT appear.
  expect(
    screen.queryByText(/bookings\.pos\.package\.catalog\.title/),
  ).not.toBeInTheDocument()
  // The flexible button itself is present and (because wired) ENABLED.
  const flexibleBtn = screen.getByRole("button", {
    name: /bookings\.pos\.package\.chooseFromPackage/,
  })
  expect(flexibleBtn).not.toBeDisabled()
})