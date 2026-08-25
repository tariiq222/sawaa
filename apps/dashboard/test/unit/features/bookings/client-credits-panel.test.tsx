/**
 * client-credits-panel.test.tsx
 *
 * Unit tests for the ClientCreditsPanel component.
 * Verifies that only usable credits (remaining > 0) are rendered, that
 * clicking the "use credit" button fires onUseCredit with the correct target,
 * and that duplicate credits with the same (serviceId, employeeId, durationOptionId)
 * triple are deduped to a single card.
 */

import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi, test, expect, beforeEach } from "vitest"

/* ─── Locale stub ─── */

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    t: (k: string) => k,
    locale: "ar",
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

/* ─── Hook mock — factory so each test can inject its own data ─── */

vi.mock("@/hooks/use-package-purchases", () => ({
  useClientPackagePurchases: vi.fn(),
}))

import { useClientPackagePurchases } from "@/hooks/use-package-purchases"
import { ClientCreditsPanel } from "@/components/features/bookings/client-credits-panel"

const mockUseClientPackagePurchases = vi.mocked(useClientPackagePurchases)

/* ─── Shared credit fixture ─── */

const CREDIT_CR1 = {
  id: "cr1",
  serviceNameAr: "خدمة",
  employeeNameAr: "موظف",
  durationLabelAr: "٤٥ د",
  totalQuantity: 5,
  usedQuantity: 1,
  remaining: 4,
  serviceIsBookable: true,
  categoryId: "cat1",
  categoryNameAr: "عيادة",
  categoryBookingMode: "SERVICES",
  departmentId: "dep1",
  departmentNameAr: "قسم",
  serviceId: "s1",
  employeeId: "e1",
  durationOptionId: "d1",
}

const CREDIT_CR2_EXHAUSTED = {
  id: "cr2",
  serviceNameAr: "منتهية",
  employeeNameAr: "م",
  durationLabelAr: "د",
  totalQuantity: 2,
  usedQuantity: 2,
  remaining: 0,
  serviceIsBookable: true,
  categoryId: "cat1",
  categoryNameAr: "عيادة",
  categoryBookingMode: "SERVICES",
  departmentId: "dep1",
  departmentNameAr: "قسم",
  serviceId: "s2",
  employeeId: "e1",
  durationOptionId: "d1",
}

/* ─── Tests ─── */

beforeEach(() => {
  mockUseClientPackagePurchases.mockReturnValue({
    data: [
      {
        id: "p1",
        packageNameAr: "باقة",
        status: "ACTIVE",
        credits: [CREDIT_CR1, CREDIT_CR2_EXHAUSTED],
      },
    ],
    isLoading: false,
  } as ReturnType<typeof useClientPackagePurchases>)
})

test("renders only usable credits and fires onUseCredit on click", async () => {
  const onUseCredit = vi.fn()
  render(<ClientCreditsPanel clientId="c1" onUseCredit={onUseCredit} />)
  expect(screen.getByText("خدمة")).toBeInTheDocument()
  expect(screen.queryByText("منتهية")).not.toBeInTheDocument() // remaining 0 hidden
  // t() stub returns the key verbatim, so the regex matches the key string, not the Arabic copy.
  screen.getByRole("button", { name: /packages\.credits\.use/ }).click()
  expect(onUseCredit).toHaveBeenCalledWith(
    expect.objectContaining({ serviceId: "s1", durationOptionId: "d1" }),
  )
})

test("dedupes credits with identical serviceId:employeeId:durationOptionId triple", () => {
  // Two ACTIVE purchases both hold a credit for the same (s1, e1, d1) triple.
  mockUseClientPackagePurchases.mockReturnValue({
    data: [
      {
        id: "p1",
        packageNameAr: "باقة أولى",
        status: "ACTIVE",
        credits: [
          { ...CREDIT_CR1, id: "cr-a", serviceNameAr: "خدمة مكررة", remaining: 4 },
        ],
      },
      {
        id: "p2",
        packageNameAr: "باقة ثانية",
        status: "ACTIVE",
        credits: [
          { ...CREDIT_CR1, id: "cr-b", serviceNameAr: "خدمة مكررة", remaining: 3 },
        ],
      },
    ],
    isLoading: false,
  } as ReturnType<typeof useClientPackagePurchases>)

  render(<ClientCreditsPanel clientId="c2" onUseCredit={vi.fn()} />)
  // Both purchases hold the same (s1, e1, d1) triple — only ONE card should appear.
  const cards = screen.getAllByText("خدمة مكررة")
  expect(cards).toHaveLength(1)
})

/* ─── W1-T3 + W2-T6 — non-jumpable credit states + display fallbacks ─── */

const CREDIT_FLEXIBLE = {
  ...CREDIT_CR1,
  id: "cr-flex",
  // Flexible credit: categoryId unresolved (the jump-only flag), display
  // labels empty, all four resolved ids null, and the service/employee no
  // longer bookable. W2-T6 widened `PackageCredit.serviceId/employeeId/
  // durationOptionId` to `string | null` to match the wire; flexible rows
  // exercise the nullable shape.
  serviceId: null,
  employeeId: null,
  durationOptionId: null,
  serviceNameAr: "",
  employeeNameAr: "",
  durationLabelAr: "",
  categoryId: null,
  categoryNameAr: "",
  categoryBookingMode: null,
  departmentId: null,
  departmentNameAr: "",
  serviceIsBookable: false,
}

const CREDIT_NOT_BOOKABLE_POPULATED = {
  ...CREDIT_CR1,
  id: "cr-inactive",
  // categoryId resolved (so NOT flexible) but the service/employee is
  // archived — must read "not bookable", not "deduct from package".
  serviceIsBookable: false,
}

test("flexible credit renders disabled flexibleUsePackagesTrack label and does not dispatch", async () => {
  // W5-T15 — the panel is jump-only by design; the flexible branch
  // cannot apply the wizard's restricted flow (that lives in the
  // PACKAGES track picker). The label must point the operator to the
  // Packages track instead of promising an action this panel cannot
  // perform.
  mockUseClientPackagePurchases.mockReturnValue({
    data: [
      {
        id: "p-flex",
        packageNameAr: "باقة مرنة",
        status: "ACTIVE",
        credits: [CREDIT_FLEXIBLE],
      },
    ],
    isLoading: false,
  } as ReturnType<typeof useClientPackagePurchases>)

  const onUseCredit = vi.fn()
  const user = userEvent.setup()
  render(<ClientCreditsPanel clientId="c3" onUseCredit={onUseCredit} />)

  const button = screen.getByRole("button", {
    name: /packages\.credits\.flexibleUsePackagesTrack/,
  })
  expect(button).toBeDisabled()
  await user.click(button)
  expect(onUseCredit).not.toHaveBeenCalled()
})

test("pinned credit with inactive service/practitioner renders disabled notBookable label", () => {
  mockUseClientPackagePurchases.mockReturnValue({
    data: [
      {
        id: "p-inactive",
        packageNameAr: "باقة",
        status: "ACTIVE",
        credits: [CREDIT_NOT_BOOKABLE_POPULATED],
      },
    ],
    isLoading: false,
  } as ReturnType<typeof useClientPackagePurchases>)

  const onUseCredit = vi.fn()
  render(<ClientCreditsPanel clientId="c4" onUseCredit={onUseCredit} />)

  const button = screen.getByRole("button", {
    name: /packages\.credits\.notBookable/,
  })
  expect(button).toBeDisabled()
  expect(onUseCredit).not.toHaveBeenCalled()
})

test("fully bookable credit dispatches onUseCredit with a non-empty categoryId string", async () => {
  mockUseClientPackagePurchases.mockReturnValue({
    data: [
      {
        id: "p-bookable",
        packageNameAr: "باقة",
        status: "ACTIVE",
        credits: [CREDIT_CR1],
      },
    ],
    isLoading: false,
  } as ReturnType<typeof useClientPackagePurchases>)

  const onUseCredit = vi.fn()
  const user = userEvent.setup()
  render(<ClientCreditsPanel clientId="c5" onUseCredit={onUseCredit} />)

  const button = screen.getByRole("button", { name: /packages\.credits\.use/ })
  expect(button).not.toBeDisabled()
  await user.click(button)
  expect(onUseCredit).toHaveBeenCalledTimes(1)
  const payload = onUseCredit.mock.calls[0][0]
  expect(typeof payload.categoryId).toBe("string")
  expect(payload.categoryId.length).toBeGreaterThan(0)
  expect(typeof payload.serviceId).toBe("string")
  expect(payload.serviceId.length).toBeGreaterThan(0)
  expect(typeof payload.employeeId).toBe("string")
  expect(payload.employeeId.length).toBeGreaterThan(0)
  expect(typeof payload.durationOptionId).toBe("string")
  expect(payload.durationOptionId.length).toBeGreaterThan(0)
})

test("flexible credit falls back to purchase name as title and skips empty subtitle parts", () => {
  mockUseClientPackagePurchases.mockReturnValue({
    data: [
      {
        id: "p-flex-display",
        packageNameAr: "باقة قواعد",
        status: "ACTIVE",
        credits: [CREDIT_FLEXIBLE],
      },
    ],
    isLoading: false,
  } as ReturnType<typeof useClientPackagePurchases>)

  render(<ClientCreditsPanel clientId="c6" onUseCredit={vi.fn()} />)

  // Title: purchase name appears because serviceNameAr is empty.
  // Scope to the card so we don't collide with the equal-looking subtitle
  // `<p>` (subtitle collapses to the same text since employeeNameAr and
  // durationLabelAr are both empty on the flexible credit).
  const matches = screen.getAllByText("باقة قواعد")
  expect(matches.length).toBeGreaterThanOrEqual(1)
  const card = matches[0].closest("div.rounded-md")
  expect(card).not.toBeNull()
  // Subtitle: only the non-empty parts get joined. With employeeNameAr
  // and durationLabelAr both empty the subtitle collapses to a bare
  // "باقة قواعد" — no " · " separator and definitely no " · · "
  // dangling separator should appear anywhere in the card.
  expect(card!.textContent ?? "").not.toMatch(/·/)
})

/* ─── W2-T6 — flexible-credit dedupe regression ─── */

test("renders BOTH flexible credits from two different purchases (dedupe regression)", () => {
  // Regression: pre-W2-T6, both credits had null triple → key "null:null:null"
  // → only the first one survived. The W2-T6 dedupe falls back to
  // `credit.id` when any triple member is null, so each flexible credit
  // gets its own key.
  mockUseClientPackagePurchases.mockReturnValue({
    data: [
      {
        id: "p-flex-a",
        packageNameAr: "باقة مرنة ١",
        status: "ACTIVE",
        credits: [
          { ...CREDIT_FLEXIBLE, id: "cr-flex-a" },
        ],
      },
      {
        id: "p-flex-b",
        packageNameAr: "باقة مرنة ٢",
        status: "ACTIVE",
        credits: [
          { ...CREDIT_FLEXIBLE, id: "cr-flex-b" },
        ],
      },
    ],
    isLoading: false,
  } as ReturnType<typeof useClientPackagePurchases>)

  render(<ClientCreditsPanel clientId="c-flex-pair" onUseCredit={vi.fn()} />)

  // Two `flexibleUsePackagesTrack` buttons — one per flexible credit.
  // W5-T15: the label is now `flexibleUsePackagesTrack` (this panel
  // is jump-only and cannot spend a flexible credit; the action lives
  // in the Packages track picker). The dedupe regression itself
  // (both credits render) is unchanged.
  const buttons = screen.getAllByRole("button", {
    name: /packages\.credits\.flexibleUsePackagesTrack/,
  })
  expect(buttons).toHaveLength(2)
  expect(buttons[0]).toBeDisabled()
  expect(buttons[1]).toBeDisabled()
})

/* ─── W5-T15 — panel must never render the dead `flexibleHint` copy ─── */

test("does not render the dead `bookings.pos.package.flexibleHint` copy anywhere", () => {
  // The translation key was deleted in W5-T15 because the copy described
  // a flow that no longer exists (the "complete the booking from the
  // Clinics track" dead-end). The panel must never reference it.
  mockUseClientPackagePurchases.mockReturnValue({
    data: [
      {
        id: "p-flex",
        packageNameAr: "باقة مرنة",
        status: "ACTIVE",
        credits: [CREDIT_FLEXIBLE],
      },
    ],
    isLoading: false,
  } as ReturnType<typeof useClientPackagePurchases>)

  const { container } = render(
    <ClientCreditsPanel clientId="c-flex-no-hint" onUseCredit={vi.fn()} />,
  )

  expect(container.textContent ?? "").not.toMatch(
    /bookings\.pos\.package\.flexibleHint/,
  )
})
