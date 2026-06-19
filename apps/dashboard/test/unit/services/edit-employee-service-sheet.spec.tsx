/**
 * edit-employee-service-sheet.spec.tsx — verifies the sheet uses the shared
 * rich editor components (EmployeeServiceToggles + EmployeeCustomPricingRow)
 * and no longer exposes a Save button in its footer.
 */

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import React from "react"

const { useServiceEmployees, useEmployeeServiceMutations } = vi.hoisted(() => ({
  useServiceEmployees: vi.fn(),
  useEmployeeServiceMutations: vi.fn(),
}))

const { useLocale } = vi.hoisted(() => ({
  useLocale: vi.fn(() => ({
    t: (k: string) => k,
    locale: "ar",
  })),
}))

vi.mock("@/hooks/use-services", () => ({ useServiceEmployees }))
vi.mock("@/hooks/use-employee-mutations", () => ({ useEmployeeServiceMutations }))
vi.mock("@/components/locale-provider", () => ({ useLocale }))

vi.mock("@/components/features/services/employee-service-toggles", () => ({
  EmployeeServiceToggles: (props: { item: { id: string } }) => (
    <div data-testid="employee-service-toggles" data-item-id={props.item.id} />
  ),
}))

vi.mock("@/components/features/services/employee-custom-pricing-row", () => ({
  EmployeeCustomPricingRow: (props: { item: { id: string }; employeeId: string }) => (
    <div
      data-testid="employee-custom-pricing-row"
      data-item-id={props.item.id}
      data-employee-id={props.employeeId}
    />
  ),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("@sawaa/ui", () => ({
  Sheet: ({
    children,
    open,
  }: {
    children: React.ReactNode
    open?: boolean
  }) => (open ? <div data-testid="sheet">{children}</div> : null),
  SheetContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-content">{children}</div>
  ),
  SheetHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-header">{children}</div>
  ),
  SheetTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="sheet-title">{children}</h2>
  ),
  SheetDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="sheet-desc">{children}</p>
  ),
  SheetBody: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-body">{children}</div>
  ),
  SheetFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-footer">{children}</div>
  ),
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}))

import { EditEmployeeServiceSheet } from "@/components/features/employees/edit-employee-service-sheet"
import type { EmployeeService } from "@/lib/types/employee"

function makeEmployeeService(): EmployeeService {
  return {
    id: "es-1",
    serviceId: "svc-1",
    bufferMinutes: 5,
    isActive: true,
    availableTypes: ["in_person"],
    service: {
      id: "svc-1",
      nameAr: "استشارة",
      nameEn: "Consultation",
      price: 0,
      duration: 0,
    },
    serviceTypes: [],
  }
}

describe("EditEmployeeServiceSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useEmployeeServiceMutations.mockReturnValue({
      updateMut: {
        isPending: false,
        variables: undefined,
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
      },
      durationsMut: {
        isPending: false,
        variables: undefined,
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
      },
    })

    useServiceEmployees.mockReturnValue({
      data: [
        {
          id: "es-1",
          employee: {
            id: "emp-1",
            nameAr: "أحمد",
            title: null,
            avatarUrl: null,
            isActive: true,
            user: { firstName: "Ahmed", lastName: "Ali" },
          },
          serviceTypes: [],
          customDuration: null,
          bufferMinutes: 5,
          availableTypes: ["in_person"],
          isActive: true,
          hasCustomPricing: false,
        },
      ],
      isLoading: false,
    })
  })

  it("renders EmployeeServiceToggles inside the sheet body", () => {
    render(
      <EditEmployeeServiceSheet
        employeeId="emp-1"
        employeeService={makeEmployeeService()}
        open
        onOpenChange={vi.fn()}
      />,
    )

    const toggles = screen.getByTestId("employee-service-toggles")
    expect(toggles).toBeInTheDocument()
    expect(toggles).toHaveAttribute("data-item-id", "es-1")
  })

  it("renders EmployeeCustomPricingRow inside the sheet body", () => {
    render(
      <EditEmployeeServiceSheet
        employeeId="emp-1"
        employeeService={makeEmployeeService()}
        open
        onOpenChange={vi.fn()}
      />,
    )

    const pricingRow = screen.getByTestId("employee-custom-pricing-row")
    expect(pricingRow).toBeInTheDocument()
    expect(pricingRow).toHaveAttribute("data-item-id", "es-1")
    expect(pricingRow).toHaveAttribute("data-employee-id", "emp-1")
  })

  it("does not render a Save button in the sheet footer", () => {
    render(
      <EditEmployeeServiceSheet
        employeeId="emp-1"
        employeeService={makeEmployeeService()}
        open
        onOpenChange={vi.fn()}
      />,
    )

    expect(screen.queryByRole("button", { name: "common.save" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "employees.services.saving" })).not.toBeInTheDocument()
    expect(screen.queryByText("common.save")).not.toBeInTheDocument()
    expect(screen.queryByText("common.cancel")).not.toBeInTheDocument()
  })

  it("does not render any footer save/cancel controls even when present in DOM", () => {
    render(
      <EditEmployeeServiceSheet
        employeeId="emp-1"
        employeeService={makeEmployeeService()}
        open
        onOpenChange={vi.fn()}
      />,
    )

    const footer = screen.queryByTestId("sheet-footer")
    expect(footer).not.toBeInTheDocument()
  })

  it("renders skeleton placeholders while the underlying ServiceEmployee is loading", () => {
    useServiceEmployees.mockReturnValue({
      data: undefined,
      isLoading: true,
    })

    render(
      <EditEmployeeServiceSheet
        employeeId="emp-1"
        employeeService={makeEmployeeService()}
        open
        onOpenChange={vi.fn()}
      />,
    )

    expect(screen.queryByTestId("employee-service-toggles")).not.toBeInTheDocument()
    expect(screen.queryByTestId("employee-custom-pricing-row")).not.toBeInTheDocument()
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0)
  })
})