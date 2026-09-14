import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi, test, expect } from "vitest"

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    t: (key: string) => ({
      "packages.grouped.credit.remaining": "{remaining} unreserved sessions remaining",
      "packages.grouped.credit.availableNow": "{count} available to book now",
      "packages.grouped.credit.session": "Session {position}",
      "packages.grouped.credit.durationMinutes": "{minutes} minutes",
      "packages.grouped.credit.dependency": "Available after completing {service} sessions",
    }[key] ?? key),
    locale: "ar",
  }),
}))

vi.mock("@sawaa/ui", () => {
  const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ children, ...props }, ref) => <button ref={ref} {...props}>{children}</button>,
  )
  Button.displayName = "Button"
  return { Button }
})

vi.mock("@hugeicons/react", () => ({ HugeiconsIcon: () => null }))

vi.mock("@/components/features/bookings/wizard-card", () => ({
  WizardCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import {
  GroupedPurchaseCredits,
} from "@/components/features/bookings/wizard-steps/grouped-purchase-credits"
import { PackageCreditPicker } from "@/components/features/bookings/wizard-steps/package-credit-picker"
import type { PackageCredit, PackagePurchase } from "@/lib/types/package-purchase"

const baseCredit: PackageCredit = {
  id: "credit-1",
  serviceId: "service-1",
  employeeId: "employee-1",
  durationOptionId: "duration-1",
  serviceNameAr: "جلسة أسرية",
  serviceNameEn: "Family session",
  employeeNameAr: "أحمد",
  employeeNameEn: "Ahmad",
  durationLabelAr: "٤٥ دقيقة",
  durationLabelEn: "45 min",
  durationMins: 45,
  unitPriceSnapshot: 10000,
  totalQuantity: 1,
  usedQuantity: 0,
  reservedQuantity: 0,
  remaining: 1,
  categoryId: "category-1",
  categoryNameAr: "الاستشارات",
  categoryNameEn: "Counseling",
  categoryBookingMode: "SERVICES",
  departmentId: "department-1",
  departmentNameAr: "القسم",
  departmentNameEn: "Department",
  serviceIsBookable: true,
  constraints: [],
  modelVersion: "GROUPED_V2",
  purchaseGroupId: "group-1",
  sessionPosition: 0,
  groupLabel: "جلسات الأسرة",
  sequenceMode: "ORDERED",
  durationMinsSnapshot: 45,
  deliveryTypeSnapshot: "IN_PERSON",
  availability: { bookable: true, reason: null },
}

function purchase(credits: PackageCredit[]): PackagePurchase {
  return {
    id: "purchase-1",
    packageId: "package-1",
    packageNameAr: "باقة الأسرة",
    packageNameEn: "Family package",
    status: "ACTIVE",
    subtotalSnapshot: 10000,
    discountSnapshot: 0,
    amountPaid: 10000,
    refundAmount: 0,
    paidAt: "2026-01-01T00:00:00.000Z",
    refundedAt: null,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    credits,
    modelVersion: "GROUPED_V2",
  }
}

test("renders one available scale and three locked clinic sessions with concrete counts", async () => {
  const onPick = vi.fn()
  const scale = {
    ...baseCredit,
    serviceNameAr: "مقياس الأسرة",
    purchaseGroupId: "scale-group",
    groupLabel: "المقياس",
  } satisfies PackageCredit
  const lockedClinic = {
    ...baseCredit,
    id: "credit-clinic-1",
    serviceNameAr: "العيادة الأسرية",
    purchaseGroupId: "clinic-group",
    sessionPosition: 0,
    groupLabel: "جلسات العيادة",
    dependsOnGroupId: "group-prerequisite",
    availability: { bookable: false, reason: "DEPENDENCY_INCOMPLETE" },
  } satisfies PackageCredit
  const lockedClinic2 = {
    ...lockedClinic,
    id: "credit-clinic-2",
    sessionPosition: 1,
  } satisfies PackageCredit
  const lockedClinic3 = {
    ...lockedClinic,
    id: "credit-clinic-3",
    sessionPosition: 2,
  } satisfies PackageCredit
  const prerequisite = {
    ...baseCredit,
    id: "credit-prerequisite",
    purchaseGroupId: "group-prerequisite",
    serviceNameAr: "التهيئة الأسرية",
    groupLabel: null,
    remaining: 0,
    usedQuantity: 1,
    availability: { bookable: false, reason: "CONSUMED" },
  } satisfies PackageCredit

  render(<GroupedPurchaseCredits purchase={purchase([scale, lockedClinic, lockedClinic2, lockedClinic3, prerequisite])} onPick={onPick} />)

  expect(screen.getByText("باقة الأسرة")).toBeInTheDocument()
  expect(screen.getByText(/4 unreserved sessions remaining/)).toBeInTheDocument()
  expect(screen.getByText(/1 available to book now/)).toBeInTheDocument()
  expect(screen.getByText("Available after completing التهيئة الأسرية sessions")).toBeInTheDocument()
  const action = screen.getByRole("button", { name: /packages\.grouped\.credit\.book/ })
  await userEvent.setup().click(action)
  expect(onPick).toHaveBeenCalledWith(scale)
  expect(screen.getAllByText("Session 1")).toHaveLength(3)
  expect(screen.getByText("Session 2")).toBeInTheDocument()
  expect(screen.getByText("Session 3")).toBeInTheDocument()
})

test("uses frozen duration minutes before the localized catalog label", () => {
  const credit = {
    ...baseCredit,
    durationLabelAr: "مدة قديمة",
    durationLabelEn: "Old duration",
    durationMinsSnapshot: 52,
  } satisfies PackageCredit

  render(<GroupedPurchaseCredits purchase={purchase([credit])} onPick={vi.fn()} />)

  expect(screen.getByText(/٥٢ minutes/)).toBeInTheDocument()
  expect(screen.queryByText("مدة قديمة")).not.toBeInTheDocument()
})

test("UNORDERED groups expose every bookable session and return the exact picked credit", async () => {
  const onPick = vi.fn()
  const first = { ...baseCredit, id: "credit-unordered-1", sequenceMode: "UNORDERED" } satisfies PackageCredit
  const second = {
    ...first,
    id: "credit-unordered-2",
    sessionPosition: 1,
  } satisfies PackageCredit

  render(<GroupedPurchaseCredits purchase={purchase([first, second])} onPick={onPick} />)

  const actions = screen.getAllByRole("button", { name: /packages\.grouped\.credit\.book/ })
  expect(actions).toHaveLength(2)
  await userEvent.setup().click(actions[1])
  expect(onPick).toHaveBeenCalledWith(second)
})

test("shows each practitioner when a grouped service was reassigned", () => {
  const reassigned = {
    ...baseCredit,
    id: "credit-reassigned",
    sessionPosition: 1,
    employeeId: "employee-2",
    employeeNameAr: "سارة",
    employeeNameEn: "Sarah",
  } satisfies PackageCredit

  render(<GroupedPurchaseCredits purchase={purchase([baseCredit, reassigned])} onPick={vi.fn()} />)

  expect(screen.getByText(/أحمد/)).toBeInTheDocument()
  expect(screen.getByText(/سارة/)).toBeInTheDocument()
  expect(screen.getAllByText("جلسة أسرية")).toHaveLength(1)
})

test("shows one shared dependency lock when every unreserved row has that dependency", () => {
  const firstLocked = {
    ...baseCredit,
    availability: { bookable: false, reason: "DEPENDENCY_INCOMPLETE" },
    dependsOnGroupId: "missing-group",
  } satisfies PackageCredit
  const secondLocked = {
    ...firstLocked,
    id: "credit-2",
    sessionPosition: 1,
  } satisfies PackageCredit

  render(<GroupedPurchaseCredits purchase={purchase([firstLocked, secondLocked])} onPick={vi.fn()} />)

  expect(screen.getByText("packages.grouped.credit.dependencyGeneric")).toBeInTheDocument()
  expect(screen.queryAllByText(/packages\.grouped\.credit\.availability\.DEPENDENCY_INCOMPLETE/)).toHaveLength(0)
})

test("keeps different per-row lock reasons visible and renders no disabled action buttons", () => {
  const credits = [
    baseCredit,
    {
      ...baseCredit,
      id: "credit-2",
      sessionPosition: 1,
      availability: { bookable: false, reason: "PREDECESSOR_INCOMPLETE" },
    },
    {
      ...baseCredit,
      id: "credit-3",
      sessionPosition: 2,
      availability: { bookable: false, reason: "RESERVED" },
    },
  ] satisfies PackageCredit[]

  render(<GroupedPurchaseCredits purchase={purchase(credits)} onPick={vi.fn()} />)

  expect(screen.getByText(/packages\.grouped\.credit\.availability\.PREDECESSOR_INCOMPLETE/)).toBeInTheDocument()
  expect(screen.getByText(/packages\.grouped\.credit\.availability\.RESERVED/)).toBeInTheDocument()
  expect(screen.getAllByRole("button", { name: /packages\.grouped\.credit\.book/ })).toHaveLength(1)
})

test("fails closed when V2 availability is missing, even for a complete credit", () => {
  const malformed = { ...baseCredit, availability: undefined }
  render(<GroupedPurchaseCredits purchase={purchase([malformed])} onPick={vi.fn()} />)

  expect(screen.queryByRole("button", { name: /packages\.grouped\.credit\.book/ })).not.toBeInTheDocument()
  expect(screen.getByText(/packages\.grouped\.credit\.availabilityMissing/)).toBeInTheDocument()
})

test("parent picker fails closed when only the purchase is marked V2 and credit markers are absent", () => {
  const purchaseOnlyV2 = {
    ...baseCredit,
    modelVersion: undefined,
    purchaseGroupId: undefined,
    sessionPosition: undefined,
    availability: undefined,
  }
  render(<PackageCreditPicker purchases={[purchase([purchaseOnlyV2])]} onPick={vi.fn()} />)

  expect(screen.queryByRole("button", { name: /packages\.grouped\.credit\.book/ })).not.toBeInTheDocument()
  expect(screen.getByText(/packages\.grouped\.credit\.availabilityMissing/)).toBeInTheDocument()
})

test("picker builds the existing target and preserves the selected credit id", async () => {
  const onPick = vi.fn()
  const pickerCredit = { ...baseCredit, id: "credit-picker", modelVersion: undefined }

  render(<PackageCreditPicker purchases={[purchase([pickerCredit])]} onPick={onPick} />)
  await userEvent.setup().click(screen.getByRole("button", { name: /packages\.grouped\.credit\.book/ }))

  expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ creditId: "credit-picker" }), "purchase-1")
})
