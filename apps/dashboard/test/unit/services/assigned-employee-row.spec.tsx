import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, it, expect, vi } from "vitest"
import type { ReactNode } from "react"

vi.mock("@/hooks/use-branches", () => ({
  useBranches: () => ({
    branches: [
      { id: "br-1", nameAr: "الرياض", nameEn: "Riyadh", isActive: true },
    ],
    isLoading: false,
  }),
}))
vi.mock("@/hooks/use-employee-schedule", () => ({
  useEmployeeSchedule: () => ({ data: [], isLoading: false }),
  useUpdateEmployeeSchedule: () => ({ mutate: vi.fn() }),
}))
vi.mock("@/hooks/use-employees", () => ({
  useEmployee: () => ({ data: undefined }),
}))
vi.mock("@/lib/api/branches", () => ({
  assignEmployeeToBranch: vi.fn(),
  unassignEmployeeFromBranch: vi.fn(),
}))

vi.mock("@/hooks/use-employee-mutations", () => ({
  useEmployeeServiceMutations: () => ({
    updateMut: { isPending: false, variables: undefined, mutate: vi.fn() },
    durationsMut: { isPending: false, variables: undefined, mutate: vi.fn() },
    customPricingMut: { isPending: false, variables: undefined, mutate: vi.fn() },
  }),
}))

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({
    t: (k: string) => k,
    locale: "ar",
    dir: "rtl" as const,
    toggleLocale: () => {},
  }),
  LocaleProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ canDo: () => true }),
}))

vi.mock("@/components/features/employees/remove-service-dialog", () => ({
  RemoveServiceDialog: () => <div data-testid="remove-service-dialog" />,
}))

vi.mock("@/components/features/services/employee-service-toggles", () => ({
  EmployeeServiceToggles: () => <div data-testid="employee-service-toggles" />,
}))
vi.mock("@/components/features/services/employee-custom-pricing-row", () => ({
  EmployeeCustomPricingRow: () => <div data-testid="employee-custom-pricing-row" />,
}))
vi.mock("@/components/features/shared/employee-avatar", () => ({
  EmployeeAvatar: () => <div data-testid="employee-avatar" />,
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("@sawaa/ui", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({ children, onClick, ...rest }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick} {...rest}>
      {children}
    </button>
  ),
  Label: ({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
  Switch: ({ id, checked, onCheckedChange, disabled, ...rest }: { id?: string; checked?: boolean; onCheckedChange?: (v: boolean) => void; disabled?: boolean; [key: string]: unknown }) => (
    <input type="checkbox" id={id} checked={checked} onChange={(e) => onCheckedChange?.(e.target.checked)} disabled={disabled} {...rest} />
  ),
  SurfaceRow: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-slot="surface-row" className={className}>
      {children}
    </div>
  ),
}))

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span data-testid="hugeicons-icon" />,
}))
vi.mock("@hugeicons/core-free-icons", () => ({
  Delete02Icon: "delete",
  ArrowRight01Icon: "arrow-right",
  PencilEdit01Icon: "pencil",
  ArrowDown01Icon: "arrow-down",
  ArrowUp01Icon: "arrow-up",
  Add01Icon: "add",
  Cancel01Icon: "cancel",
  Search01Icon: "search",
}))

import { AssignedEmployeeRow } from "@/components/features/services/assigned-employee-row"
import type { ServiceEmployee } from "@/lib/types/service"

const item: ServiceEmployee = {
  id: "se-1",
  employee: {
    id: "emp-1",
    nameAr: "فاطمة",
    title: "طبيبة عامة",
    avatarUrl: null,
    isActive: true,
    branchIds: ["br-1"],
    user: { firstName: "فاطمة", lastName: "الزهراني" },
  },
  serviceTypes: [],
  customDuration: null,
  bufferMinutes: 0,
  availableTypes: ["ONLINE"],
  isActive: true,
  hasCustomPricing: false,
  effectiveDurations: [],
}

function renderWithProviders(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe("AssignedEmployeeRow with EmployeeWorkingInfo", () => {
  it("renders the active toggle and custom pricing row", () => {
    renderWithProviders(
      <AssignedEmployeeRow
        item={item}
        serviceId="svc-1"
        isAr
        t={(k) => k}
        onView={vi.fn()}
      />,
    )

    expect(screen.getByText("services.create.isActive")).toBeInTheDocument()
    expect(screen.getByTestId("employee-custom-pricing-row")).toBeInTheDocument()
  })

  it("falls back gracefully when branchIds is undefined on the employee", () => {
    const itemWithoutBranches: ServiceEmployee = {
      ...item,
      employee: { ...item.employee, branchIds: undefined },
    }

    renderWithProviders(
      <AssignedEmployeeRow
        item={itemWithoutBranches}
        serviceId="svc-1"
        isAr
        t={(k) => k}
        onView={vi.fn()}
      />,
    )

    // Component renders without error when branchIds is undefined
    expect(screen.getByTestId("employee-custom-pricing-row")).toBeInTheDocument()
  })
})
