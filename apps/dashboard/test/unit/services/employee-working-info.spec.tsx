import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { ReactNode } from "react"

const {
  useBranches,
  useEmployeeSchedule,
  useUpdateEmployeeSchedule,
  useEmployee,
  assignEmployeeToBranch,
  unassignEmployeeFromBranch,
} = vi.hoisted(() => ({
  useBranches: vi.fn(),
  useEmployeeSchedule: vi.fn(),
  useUpdateEmployeeSchedule: vi.fn(),
  useEmployee: vi.fn(),
  assignEmployeeToBranch: vi.fn(),
  unassignEmployeeFromBranch: vi.fn(),
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

vi.mock("@/hooks/use-branches", () => ({ useBranches }))
vi.mock("@/hooks/use-employee-schedule", () => ({
  useEmployeeSchedule,
  useUpdateEmployeeSchedule,
}))
vi.mock("@/hooks/use-employees", () => ({ useEmployee }))
vi.mock("@/lib/api/branches", () => ({
  assignEmployeeToBranch,
  unassignEmployeeFromBranch,
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("@sawaa/ui", () => ({
  Button: ({
    children,
    onClick,
    ...rest
  }: {
    children: ReactNode
    onClick?: () => void
  }) => (
    <button type="button" onClick={onClick} {...rest}>
      {children}
    </button>
  ),
  Input: ({
    value,
    onChange,
    type,
    ...rest
  }: {
    value?: string
    onChange?: (e: { target: { value: string } }) => void
    type?: string
  } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <input value={value} onChange={onChange} type={type} {...rest} />
  ),
  Switch: ({
    checked,
    onCheckedChange,
    ...rest
  }: {
    checked?: boolean
    onCheckedChange?: (next: boolean) => void
  }) => (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      onClick={() => onCheckedChange?.(!checked)}
      {...rest}
    />
  ),
  Skeleton: ({ className }: { className?: string }) => (
    <span data-testid="skeleton" className={className} />
  ),
  SurfaceRow: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div data-slot="surface-row" className={className}>
      {children}
    </div>
  ),
}))

import { EmployeeWorkingInfo } from "@/components/features/services/employee-working-info"

function renderWithQuery(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe("EmployeeWorkingInfo — compact", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useEmployee).mockReturnValue({ data: undefined } as never)
    vi.mocked(useBranches).mockReturnValue({
      branches: [
        { id: "br-1", nameAr: "الرياض", nameEn: "Riyadh", isActive: true },
        { id: "br-2", nameAr: "العليا", nameEn: "Olaya", isActive: true },
        { id: "br-3", nameAr: "دبلوماسي", nameEn: "Diplomatic", isActive: true },
        { id: "br-4", nameAr: "النخيل", nameEn: "Palm", isActive: true },
      ],
      isLoading: false,
    } as never)
  })

  it("shows first 3 branches + overflow count", () => {
    vi.mocked(useEmployeeSchedule).mockReturnValue({ data: [] } as never)
    vi.mocked(useUpdateEmployeeSchedule).mockReturnValue({} as never)

    renderWithQuery(<EmployeeWorkingInfo employeeId="emp-1" branchIds={["br-1", "br-2", "br-3", "br-4"]} />)

    expect(screen.getByText("الرياض")).toBeInTheDocument()
    expect(screen.getByText("العليا")).toBeInTheDocument()
    expect(screen.getByText("دبلوماسي")).toBeInTheDocument()
    expect(screen.getByText("+1")).toBeInTheDocument()
  })

  it("shows empty state messages when no branches and no schedule", () => {
    vi.mocked(useEmployeeSchedule).mockReturnValue({ data: [] } as never)
    vi.mocked(useUpdateEmployeeSchedule).mockReturnValue({} as never)

    renderWithQuery(<EmployeeWorkingInfo employeeId="emp-1" branchIds={[]} />)

    expect(screen.getByText("services.employees.workingInfo.noBranches")).toBeInTheDocument()
    expect(screen.getByText("services.employees.workingInfo.scheduleNone")).toBeInTheDocument()
  })

  it("renders a varied schedule summary when hours differ per day", () => {
    vi.mocked(useEmployeeSchedule).mockReturnValue({
      data: [
        { dayOfWeek: 0, startTime: "09:00", endTime: "17:00", isActive: true },
        { dayOfWeek: 1, startTime: "10:00", endTime: "15:00", isActive: true },
      ],
    } as never)
    vi.mocked(useUpdateEmployeeSchedule).mockReturnValue({} as never)

    renderWithQuery(<EmployeeWorkingInfo employeeId="emp-1" branchIds={["br-1"]} />)

    expect(screen.getByText("services.employees.workingInfo.scheduleVaried")).toBeInTheDocument()
  })
})

describe("EmployeeWorkingInfo — expanded", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useEmployee).mockReturnValue({ data: undefined } as never)
    vi.mocked(useBranches).mockReturnValue({
      branches: [
        { id: "br-1", nameAr: "الرياض", nameEn: "Riyadh", isActive: true },
        { id: "br-2", nameAr: "العليا", nameEn: "Olaya", isActive: true },
      ],
      isLoading: false,
    } as never)
  })

  it("expands on header click and shows editors", () => {
    vi.mocked(useEmployeeSchedule).mockReturnValue({ data: [] } as never)
    vi.mocked(useUpdateEmployeeSchedule).mockReturnValue({} as never)

    renderWithQuery(<EmployeeWorkingInfo employeeId="emp-1" branchIds={["br-1"]} />)
    fireEvent.click(screen.getByText("services.employees.workingInfo.title"))
    expect(screen.getByText("services.employees.workingInfo.addBranch")).toBeInTheDocument()
    expect(screen.getByText("services.employees.workingInfo.day.sat")).toBeInTheDocument()
  })

  it("calls unassign when a branch chip × is clicked", async () => {
    vi.mocked(useEmployeeSchedule).mockReturnValue({ data: [] } as never)
    vi.mocked(useUpdateEmployeeSchedule).mockReturnValue({} as never)

    renderWithQuery(<EmployeeWorkingInfo employeeId="emp-1" branchIds={["br-1", "br-2"]} />)
    fireEvent.click(screen.getByText("services.employees.workingInfo.title"))
    const branchRow = screen.getAllByText("الرياض")[0].closest("[data-testid='branch-row']") as HTMLElement
    fireEvent.click(within(branchRow).getByRole("button"))
    await waitFor(() => expect(unassignEmployeeFromBranch).toHaveBeenCalledWith("br-1", "emp-1"))
  })

  it("calls useUpdateEmployeeSchedule on day toggle change", async () => {
    const mutate = vi.fn()
    vi.mocked(useUpdateEmployeeSchedule).mockReturnValue({
      mutate,
      mutateAsync: mutate,
      isPending: false,
    } as never)
    vi.mocked(useEmployeeSchedule).mockReturnValue({
      data: [{ dayOfWeek: 0, startTime: "09:00", endTime: "17:00", isActive: true }],
    } as never)

    renderWithQuery(<EmployeeWorkingInfo employeeId="emp-1" branchIds={[]} />)
    fireEvent.click(screen.getByText("services.employees.workingInfo.title"))
    const switches = screen.getAllByRole("switch", { name: /services.employees.workingInfo.dayActive/i })
    fireEvent.click(switches[0])
    await waitFor(() => expect(mutate).toHaveBeenCalled())
    const payload = mutate.mock.calls[0][0]
    expect(payload[0].isActive).toBe(false)
  })
})