/**
 * package-credit-picker.spec.tsx
 *
 * Unit tests for the wizard-step PackageCreditPicker (EXISTING-mode).
 * Covers:
 *   - jumpable credit  -> ENABLED `use`, fires `onPick` with full CreditTarget
 *   - flexible credit  -> ENABLED `chooseFromPackage`, fires `onPickFlexible`
 *                         with `(credit, purchaseId, purchaseName)`, never
 *                         fires `onPick`
 *   - pinned-but-inactive credit -> DISABLED `notBookable`, fires nothing
 *   - flexible branch with NO onPickFlexible wired -> DISABLED (absent-callback
 *     fallback for callers that haven't wired `applyCreditFilter` yet)
 *   - two flexible credits from two different purchases both render
 *     (dedupe regression: pre-W2-T6 they collapsed onto `"null:null:null"`)
 *   - `bookings.pos.package.unavailable` and
 *     `bookings.pos.package.flexibleHint` are NOT rendered anywhere
 *     (W5-T15 deleted the dead keys from both AR and EN books)
 *   - credits with `remaining === 0` are filtered out
 *
 * Mirrors the locale-stub style of `client-credits-panel.test.tsx` (the
 * `t()` stub returns the key verbatim — assertions use the key as a regex).
 */

import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi, test, expect, beforeEach } from "vitest"

/* ─── Locale stub (verbatim from client-credits-panel) ─── */

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    t: (k: string) => k,
    locale: "ar",
    dir: "rtl" as const,
    toggleLocale: vi.fn(),
  }),
}))

/* ─── UI primitives stub ─── */

vi.mock("@sawaa/ui", () => {
  const Button = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: string; disabled?: boolean }
  >(({ children, onClick, disabled, ...props }, ref) => (
    <button ref={ref} onClick={onClick} disabled={disabled} aria-label={typeof children === "string" ? children : undefined} {...props}>
      {children}
    </button>
  ))
  Button.displayName = "Button"
  return { Button }
})

/* ─── Heavy UI collaborators stubbed so we test the picker in isolation ─── */

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => null,
}))

vi.mock("@/components/features/bookings/wizard-card", () => ({
  WizardCard: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode
    onClick: () => void
    disabled?: boolean
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))

/* ─── Subject under test ─── */

import {
  PackageCreditPicker,
  purchaseName,
} from "@/components/features/bookings/wizard-steps/package-credit-picker"

import type {
  PackageCredit,
  PackagePurchase,
} from "@/lib/types/package-purchase"

/* ─── Shared fixtures ─── */

const JUMPABLE: PackageCredit = {
  id: "cr-jump",
  serviceId: "s1",
  employeeId: "e1",
  durationOptionId: "d1",
  serviceNameAr: "استشارة",
  serviceNameEn: "Consultation",
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
  constraints: [],
}

const FLEXIBLE: PackageCredit = {
  // All four resolved ids null, display labels blank, no longer bookable.
  // Mirrors the wire shape for a rule-based credit.
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
  constraints: [],
}

const NOT_BOOKABLE_PINNED: PackageCredit = {
  // categoryId resolved (so NOT flexible) but service/employee archived.
  ...JUMPABLE,
  id: "cr-not-bookable",
  serviceIsBookable: false,
}

const EXHAUSTED: PackageCredit = {
  ...JUMPABLE,
  id: "cr-spent",
  remaining: 0,
}

const PURCHASE_JUMPABLE: PackagePurchase = {
  id: "p-jump",
  packageId: "pkg-1",
  packageNameAr: "باقة ١",
  packageNameEn: "Package 1",
  status: "ACTIVE",
  subtotalSnapshot: 0,
  discountSnapshot: 0,
  amountPaid: 0,
  refundAmount: 0,
  paidAt: "2026-01-01T00:00:00.000Z",
  refundedAt: null,
  notes: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  credits: [JUMPABLE],
}

const PURCHASE_FLEXIBLE: PackagePurchase = {
  ...PURCHASE_JUMPABLE,
  id: "p-flex",
  packageNameAr: "باقة مرنة",
  packageNameEn: "Flexible package",
  credits: [FLEXIBLE],
}

const PURCHASE_NOT_BOOKABLE: PackagePurchase = {
  ...PURCHASE_JUMPABLE,
  id: "p-not-bookable",
  packageNameAr: "باقة معطلة",
  packageNameEn: "Inactive package",
  credits: [NOT_BOOKABLE_PINNED],
}

beforeEach(() => {
  vi.clearAllMocks()
})

/* ─── Jumpable branch ─── */

test("jumpable credit: enabled `use` label, fires onPick with full CreditTarget", async () => {
  const onPick = vi.fn()
  const onPickFlexible = vi.fn()
  const user = userEvent.setup()

  render(
    <PackageCreditPicker
      purchases={[PURCHASE_JUMPABLE]}
      onPick={onPick}
      onPickFlexible={onPickFlexible}
    />,
  )

  const button = screen.getByRole("button", { name: /bookings\.pos\.package\.use/ })
  expect(button).not.toBeDisabled()
  await user.click(button)

  expect(onPick).toHaveBeenCalledTimes(1)
  expect(onPickFlexible).not.toHaveBeenCalled()

  const [target, purchaseId] = onPick.mock.calls[0]
  expect(purchaseId).toBe(PURCHASE_JUMPABLE.id)
  // Every CreditTarget id field must be a non-empty string.
  expect(typeof target.categoryId).toBe("string")
  expect(target.categoryId.length).toBeGreaterThan(0)
  expect(typeof target.serviceId).toBe("string")
  expect(target.serviceId.length).toBeGreaterThan(0)
  expect(typeof target.employeeId).toBe("string")
  expect(target.employeeId.length).toBeGreaterThan(0)
  expect(typeof target.durationOptionId).toBe("string")
  expect(target.durationOptionId.length).toBeGreaterThan(0)
})

/* ─── Flexible branch (ENABLED when wired) ─── */

test("flexible credit: enabled `chooseFromPackage` label, fires onPickFlexible with credit+id+name, NOT onPick", async () => {
  const onPick = vi.fn()
  const onPickFlexible = vi.fn()
  const user = userEvent.setup()

  render(
    <PackageCreditPicker
      purchases={[PURCHASE_FLEXIBLE]}
      onPick={onPick}
      onPickFlexible={onPickFlexible}
    />,
  )

  const button = screen.getByRole("button", {
    name: /bookings\.pos\.package\.chooseFromPackage/,
  })
  expect(button).not.toBeDisabled()
  await user.click(button)

  expect(onPickFlexible).toHaveBeenCalledTimes(1)
  expect(onPick).not.toHaveBeenCalled()

  const [creditArg, purchaseIdArg, packageNameArg] = onPickFlexible.mock.calls[0]
  expect(creditArg).toBe(FLEXIBLE)
  expect(purchaseIdArg).toBe(PURCHASE_FLEXIBLE.id)
  expect(packageNameArg).toBe(purchaseName(PURCHASE_FLEXIBLE, "ar"))
  expect(packageNameArg).toBe("باقة مرنة")
})

/* ─── Flexible branch WITHOUT onPickFlexible wired (absent-callback fallback) ─── */

test("flexible credit with no onPickFlexible callback renders disabled (absent-callback fallback)", () => {
  // The Picker contract marks onPickFlexible optional so callers that
  // don't yet wire the wizard's restricted flexible flow keep compiling.
  // Without the callback, the flexible branch must be DISABLED — the
  // picker surfaces the action label without firing it.
  const onPick = vi.fn()

  render(
    <PackageCreditPicker
      purchases={[PURCHASE_FLEXIBLE]}
      onPick={onPick}
    />,
  )

  const button = screen.getByRole("button", {
    name: /bookings\.pos\.package\.chooseFromPackage/,
  })
  expect(button).toBeDisabled()
})

/* ─── Pinned-but-inactive branch ─── */

test("pinned-but-inactive credit: disabled `notBookable` label, fires nothing", async () => {
  const onPick = vi.fn()
  const onPickFlexible = vi.fn()
  const user = userEvent.setup()

  render(
    <PackageCreditPicker
      purchases={[PURCHASE_NOT_BOOKABLE]}
      onPick={onPick}
      onPickFlexible={onPickFlexible}
    />,
  )

  const button = screen.getByRole("button", {
    name: /bookings\.pos\.package\.notBookable/,
  })
  expect(button).toBeDisabled()
  await user.click(button)

  expect(onPick).not.toHaveBeenCalled()
  expect(onPickFlexible).not.toHaveBeenCalled()
})

/* ─── Dedupe regression: two flexible credits from two purchases ─── */

test("renders BOTH flexible credits from two different purchases (dedupe regression)", () => {
  // Pre-W2-T6 both rows collapsed onto `"null:null:null"` and only the
  // first one rendered. The W2-T6 dedupe falls back to `credit.id` when
  // any triple member is null.
  const buyA: PackagePurchase = {
    ...PURCHASE_FLEXIBLE,
    id: "p-flex-a",
    packageNameAr: "باقة مرنة ١",
    credits: [{ ...FLEXIBLE, id: "cr-flex-a" }],
  }
  const buyB: PackagePurchase = {
    ...PURCHASE_FLEXIBLE,
    id: "p-flex-b",
    packageNameAr: "باقة مرنة ٢",
    credits: [{ ...FLEXIBLE, id: "cr-flex-b" }],
  }

  render(
    <PackageCreditPicker
      purchases={[buyA, buyB]}
      onPick={vi.fn()}
      onPickFlexible={vi.fn()}
    />,
  )

  const buttons = screen.getAllByRole("button", {
    name: /bookings\.pos\.package\.chooseFromPackage/,
  })
  expect(buttons).toHaveLength(2)
  // Both rows must be ENABLED — the picker surfaces the "deduct from
  // package" action for every flexible credit regardless of which
  // purchase it belongs to.
  expect(buttons[0]).not.toBeDisabled()
  expect(buttons[1]).not.toBeDisabled()
})

/* ─── Forbidden copy: `unavailable` and `flexibleHint` must NOT appear ─── */

test("does not render the legacy `unavailable` label or the `flexibleHint` copy", () => {
  // W2-T6 replaced the misleading "غير متاح" with `chooseFromPackage`
  // for flexible credits and `notBookable` for pinned-but-inactive ones.
  // W5-T15 deleted the dead translation keys (`bookings.pos.package.unavailable`,
  // `bookings.pos.package.flexibleHint`, `packages.credits.unavailable`)
  // from both AR and EN books. The picker must never reference them
  // either way.
  const { container } = render(
    <PackageCreditPicker
      purchases={[PURCHASE_FLEXIBLE, PURCHASE_NOT_BOOKABLE]}
      onPick={vi.fn()}
      onPickFlexible={vi.fn()}
    />,
  )

  expect(container.textContent ?? "").not.toMatch(/bookings\.pos\.package\.unavailable/)
  expect(container.textContent ?? "").not.toMatch(/bookings\.pos\.package\.flexibleHint/)
})

/* ─── Filter: `remaining === 0` is dropped before render ─── */

test("credits with remaining === 0 are filtered out", () => {
  const purchaseWithSpent: PackagePurchase = {
    ...PURCHASE_JUMPABLE,
    id: "p-spent",
    credits: [EXHAUSTED],
  }

  render(
    <PackageCreditPicker
      purchases={[purchaseWithSpent]}
      onPick={vi.fn()}
      onPickFlexible={vi.fn()}
    />,
  )

  // The empty-state copy should render because filterUsableCredits dropped
  // the only credit (remaining === 0).
  expect(
    screen.getByText(/bookings\.pos\.package\.existing\.empty/),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole("button", { name: /bookings\.pos\.package\.use/ }),
  ).not.toBeInTheDocument()
})

/* ─── Flexible subtitle pair (replaces flexibleHint) ─── */

test("flexible credit renders flexibleTitle + flexibleSubtitle, not the old flexibleHint", () => {
  render(
    <PackageCreditPicker
      purchases={[PURCHASE_FLEXIBLE]}
      onPick={vi.fn()}
      onPickFlexible={vi.fn()}
    />,
  )

  // Both pieces of the new copy must be present in the row.
  expect(
    screen.getByText(/bookings\.pos\.package\.flexibleTitle/),
  ).toBeInTheDocument()
  expect(
    screen.getByText(/bookings\.pos\.package\.flexibleSubtitle/),
  ).toBeInTheDocument()
})
