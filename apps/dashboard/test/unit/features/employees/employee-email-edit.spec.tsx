import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  updateEmployee: vi.fn(),
  uploadEmployeeAvatar: vi.fn(),
  setAvailability: vi.fn(),
  setBreaks: vi.fn(),
  createVacation: vi.fn(),
  updateEmployeeService: vi.fn(),
  assignService: vi.fn(),
  setEmployeeDurations: vi.fn(),
  setEmployeePricingMode: vi.fn(),
  assignEmployeeToBranch: vi.fn(),
  unassignEmployeeFromBranch: vi.fn(),
  fetchBranches: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}))

vi.mock("@/hooks/use-employee-mutations", () => ({
  useEmployeeMutations: () => ({
    onboardMutation: { mutateAsync: vi.fn() },
    updateMutation: { mutateAsync: mocks.updateEmployee },
  }),
  useSetAvailability: () => ({ mutateAsync: mocks.setAvailability }),
  useSetBreaks: () => ({ mutateAsync: mocks.setBreaks }),
  useVacationMutations: () => ({
    createMut: { mutateAsync: mocks.createVacation },
  }),
  useEmployeeServiceMutations: () => ({
    updateMut: { mutateAsync: mocks.updateEmployeeService },
  }),
}))

vi.mock("@/lib/api/employees", () => ({
  assignService: mocks.assignService,
  deleteEmployee: vi.fn(),
  setEmployeeDurations: mocks.setEmployeeDurations,
  setEmployeePricingMode: mocks.setEmployeePricingMode,
  uploadEmployeeAvatar: mocks.uploadEmployeeAvatar,
}))

vi.mock("@/lib/api/branches", () => ({
  assignEmployeeToBranch: mocks.assignEmployeeToBranch,
  unassignEmployeeFromBranch: mocks.unassignEmployeeFromBranch,
  fetchBranches: mocks.fetchBranches,
}))

import { useEmployeeForm } from "@/components/features/employees/use-employee-form"
import { createEmployeeEmailSchema } from "@/lib/schemas/employee.schema"

function makeForm(submitData: Record<string, unknown>) {
  return {
    reset: vi.fn(),
    handleSubmit:
      (onValid: (data: Record<string, unknown>) => Promise<void>) => async () =>
        onValid(submitData),
  }
}

const baseOptions = {
  isEdit: true,
  employeeId: "emp-1",
  availability: undefined,
  existingBreaks: undefined,
  existingServices: undefined,
  schedule: [],
  setSchedule: vi.fn(),
  breaks: [],
  setBreaksState: vi.fn(),
  draftServices: [],
  setDraftServices: vi.fn(),
  vacation: { enabled: false, startDate: "", endDate: "", reason: "" },
  branchIds: [],
  setBranchIds: vi.fn(),
  setIsSubmitting: vi.fn(),
}

describe("employee edit email", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updateEmployee.mockResolvedValue({ id: "emp-1" })
  })

  it("hydrates a populated employee email into the shared edit form", async () => {
    const form = makeForm({})

    renderHook(() =>
      useEmployeeForm({
        ...baseOptions,
        employee: {
          user: {
            firstName: "Dana",
            lastName: "Smith",
            email: "dana@clinic.com",
          },
          isActive: true,
        },
        form: form as never,
      })
    )

    await waitFor(() =>
      expect(form.reset).toHaveBeenCalledWith(
        expect.objectContaining({ email: "dana@clinic.com" })
      )
    )
  })

  it("submits an email added to an employee whose current email is empty", async () => {
    const form = makeForm({ email: "new@clinic.com", isActive: true })
    const { result } = renderHook(() =>
      useEmployeeForm({
        ...baseOptions,
        employee: {
          user: { firstName: "Dana", lastName: "Smith", email: "" },
          isActive: true,
        },
        form: form as never,
      })
    )

    await act(async () => {
      await result.current.onSubmit()
    })

    expect(mocks.updateEmployee).toHaveBeenCalledWith(
      expect.objectContaining({ id: "emp-1", email: "new@clinic.com" })
    )
  })

  it("omits a blank edit email instead of sending an empty string", async () => {
    const form = makeForm({ email: "", isActive: true })
    const { result } = renderHook(() =>
      useEmployeeForm({
        ...baseOptions,
        employee: {
          user: { firstName: "Dana", lastName: "Smith", email: "" },
          isActive: true,
        },
        form: form as never,
      })
    )

    await act(async () => {
      await result.current.onSubmit()
    })

    expect(mocks.updateEmployee).toHaveBeenCalledWith(
      expect.objectContaining({ id: "emp-1", email: undefined })
    )
    expect(mocks.updateEmployee.mock.calls[0]?.[0].email).not.toBe("")
  })

  it("rejects a non-empty invalid email while allowing an empty edit value", () => {
    const schema = createEmployeeEmailSchema((key) => key)

    expect(schema.safeParse("not-an-email").success).toBe(false)
    expect(schema.safeParse("").success).toBe(true)
  })
})
