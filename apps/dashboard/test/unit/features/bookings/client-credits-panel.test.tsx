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
