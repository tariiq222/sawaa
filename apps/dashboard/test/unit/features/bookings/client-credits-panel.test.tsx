/**
 * client-credits-panel.test.tsx
 *
 * Unit tests for the ClientCreditsPanel component.
 * Verifies that only usable credits (remaining > 0) are rendered, and that
 * clicking the "use credit" button fires onUseCredit with the correct target.
 */

import React from "react"
import { render, screen } from "@testing-library/react"
import { vi, test, expect } from "vitest"

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

/* ─── Hook mock — CORRECTED: returns raw useQuery shape ({ data, isLoading }) ─── */

vi.mock("@/hooks/use-package-purchases", () => ({
  useClientPackagePurchases: () => ({
    data: [
      {
        id: "p1",
        packageNameAr: "باقة",
        status: "ACTIVE",
        credits: [
          {
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
          },
          {
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
          },
        ],
      },
    ],
    isLoading: false,
  }),
}))

import { ClientCreditsPanel } from "@/components/features/bookings/client-credits-panel"

test("renders only usable credits and fires onUseCredit on click", async () => {
  const onUseCredit = vi.fn()
  render(<ClientCreditsPanel clientId="c1" onUseCredit={onUseCredit} />)
  expect(screen.getByText("خدمة")).toBeInTheDocument()
  expect(screen.queryByText("منتهية")).not.toBeInTheDocument() // remaining 0 hidden
  screen.getByRole("button", { name: /packages\.credits\.use/ }).click()
  expect(onUseCredit).toHaveBeenCalledWith(
    expect.objectContaining({ serviceId: "s1", durationOptionId: "d1" }),
  )
})
