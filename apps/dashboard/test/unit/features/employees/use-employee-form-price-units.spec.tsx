import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  onboardEmployee: vi.fn(),
  updateEmployee: vi.fn(),
  setAvailability: vi.fn(),
  setBreaks: vi.fn(),
  createVacation: vi.fn(),
  updateEmployeeService: vi.fn(),
  removeEmployeeService: vi.fn(),
  setEmployeeDurations: vi.fn(),
  setEmployeePricingMode: vi.fn(),
  assignService: vi.fn(),
  deleteEmployee: vi.fn(),
  setEmployeeServiceOptions: vi.fn(),
  uploadEmployeeAvatar: vi.fn(),
  assignEmployeeToBranch: vi.fn(),
  unassignEmployeeFromBranch: vi.fn(),
  fetchBranches: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}))

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    warning: mocks.toastWarning,
    error: mocks.toastError,
  },
}))

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}))

vi.mock("@/hooks/use-employee-mutations", () => ({
  useEmployeeMutations: () => ({
    invalidateCatalog: vi.fn(),
    onboardMutation: { mutateAsync: mocks.onboardEmployee },
    updateMutation: { mutateAsync: mocks.updateEmployee },
  }),
  useSetAvailability: () => ({ mutateAsync: mocks.setAvailability }),
  useSetBreaks: () => ({ mutateAsync: mocks.setBreaks }),
  useVacationMutations: () => ({
    createMut: { mutateAsync: mocks.createVacation },
  }),
  useEmployeeServiceMutations: () => ({
    updateMut: { mutateAsync: mocks.updateEmployeeService },
    removeMut: { mutateAsync: mocks.removeEmployeeService },
  }),
}))

vi.mock("@/lib/api/employees", () => ({
  assignService: mocks.assignService,
  deleteEmployee: mocks.deleteEmployee,
  setEmployeeServiceOptions: mocks.setEmployeeServiceOptions,
  uploadEmployeeAvatar: mocks.uploadEmployeeAvatar,
  setEmployeeDurations: mocks.setEmployeeDurations,
  setEmployeePricingMode: mocks.setEmployeePricingMode,
}))

vi.mock("@/lib/api/branches", () => ({
  assignEmployeeToBranch: mocks.assignEmployeeToBranch,
  unassignEmployeeFromBranch: mocks.unassignEmployeeFromBranch,
  fetchBranches: mocks.fetchBranches,
}))

import { useEmployeeForm } from "@/components/features/employees/use-employee-form"

function makeForm(submitData: Record<string, unknown>) {
  return {
    reset: vi.fn(),
    handleSubmit:
      (onValid: (data: Record<string, unknown>) => Promise<void>) => async () =>
        onValid(submitData),
  }
}

const employeeFormData = {
  title: "Consultant",
  nameEn: "Dana Smith",
  nameAr: "دانا سميث",
  email: "dana@example.com",
  phone: "",
  gender: "FEMALE",
  employmentType: "FULL_TIME",
  specialty: "Family counseling",
  specialtyAr: "استشارات أسرية",
  bio: "",
  bioAr: "",
  experience: 5,
  education: "",
  educationAr: "",
  avatarUrl: "",
  isActive: true,
}

const draftService = {
  key: "draft-1",
  serviceId: "svc-1",
  serviceName: "جلسة أسرية",
  bufferMinutes: 10,
  isActive: true,
  availableTypes: ["in_person"],
  serviceBookingTypes: [
    {
      id: "bt-1",
      serviceId: "svc-1",
      deliveryType: "IN_PERSON" as const,
      price: 15000,
      durationMins: 45,
      isActive: true,
      useCustomAvailability: false,
      availabilityWindows: [],
      durationOptions: [
        {
          id: "opt-45",
          serviceId: "svc-1",
          deliveryType: "IN_PERSON" as const,
          label: "45 minutes",
          labelAr: "٤٥ دقيقة",
          durationMins: 45,
          price: 15000,
          currency: "SAR",
          isDefault: true,
          sortOrder: 0,
        },
        {
          id: "opt-90",
          serviceId: "svc-1",
          deliveryType: "IN_PERSON" as const,
          label: "90 minutes",
          labelAr: "٩٠ دقيقة",
          durationMins: 90,
          price: 30000,
          currency: "SAR",
          isDefault: false,
          sortOrder: 1,
        },
      ],
    },
  ],
  types: [
    {
      deliveryType: "in_person",
      price: 150,
      duration: 45,
      isActive: true,
    },
  ],
}

const baseOptions = {
  employeeId: undefined,
  employee: undefined,
  availability: undefined,
  existingBreaks: undefined,
  existingServices: undefined,
  schedule: [],
  setSchedule: vi.fn(),
  breaks: [],
  setBreaksState: vi.fn(),
  draftServices: [draftService],
  setDraftServices: vi.fn(),
  vacation: { enabled: false, startDate: "", endDate: "", reason: "" },
  branchIds: [],
  setBranchIds: vi.fn(),
  setIsSubmitting: vi.fn(),
}

describe("useEmployeeForm service price units", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.onboardEmployee.mockResolvedValue({ employee: { id: "emp-new" } })
    mocks.updateEmployee.mockResolvedValue({ id: "emp-1" })
    mocks.assignService.mockResolvedValue({ id: "employee-service-new" })
    mocks.updateEmployeeService.mockResolvedValue({ id: "employee-service-1" })
    mocks.deleteEmployee.mockResolvedValue(undefined)
    mocks.setEmployeeServiceOptions.mockResolvedValue([])
    mocks.assignEmployeeToBranch.mockResolvedValue({ id: "eb-1" })
    mocks.unassignEmployeeFromBranch.mockResolvedValue({ id: "eb-1" })
    mocks.fetchBranches.mockResolvedValue({ items: [{ id: "main-branch", isMain: true }], meta: {} })
  })

  it("creates employee service by assigning serviceId — no options payload (durationOptions UI removed)", async () => {
    const form = makeForm(employeeFormData)
    const { result } = renderHook(() =>
      useEmployeeForm({
        ...baseOptions,
        isEdit: false,
        form: form as never,
      }),
    )

    await act(async () => {
      await result.current.onSubmit()
    })

    // assignService links the service by id
    expect(mocks.assignService).toHaveBeenCalledWith("emp-new", {
      serviceId: "svc-1",
    })
    // buildEmployeeServiceOptionsPayload always returns null — no options call
    expect(mocks.setEmployeeServiceOptions).not.toHaveBeenCalled()
  })

  it("converts edit employee service price from SAR to halalas — no options payload (durationOptions UI removed)", async () => {
    const form = makeForm(employeeFormData)
    const { result } = renderHook(() =>
      useEmployeeForm({
        ...baseOptions,
        isEdit: true,
        employeeId: "emp-1",
        employee: {
          user: { firstName: "Dana", lastName: "Smith" },
          isActive: true,
        },
        existingServices: [
          {
            id: "employee-service-1",
            serviceId: "svc-1",
            isActive: true,
            service: {
              id: "svc-1",
              nameAr: "جلسة أسرية",
              nameEn: "Family session",
              price: 15000,
              duration: 45,
            },
          },
        ],
        form: form as never,
      }),
    )

    await act(async () => {
      await result.current.onSubmit()
    })

    expect(mocks.updateEmployeeService).toHaveBeenCalledWith({
      serviceId: "svc-1",
      payload: expect.objectContaining({
        types: [
          expect.objectContaining({
            deliveryType: "in_person",
            price: 15000,
          }),
        ],
      }),
    })
    // buildEmployeeServiceOptionsPayload always returns null — no options call
    expect(mocks.setEmployeeServiceOptions).not.toHaveBeenCalled()
  })

  it("rolls back the created employee when a create follow-up step fails", async () => {
    mocks.assignEmployeeToBranch.mockRejectedValueOnce(new Error("branch assignment failed"))
    const form = makeForm(employeeFormData)
    const { result } = renderHook(() =>
      useEmployeeForm({
        ...baseOptions,
        isEdit: false,
        branchIds: ["branch-1"],
        draftServices: [],
        form: form as never,
      }),
    )

    await act(async () => {
      await result.current.onSubmit()
    })

    expect(mocks.deleteEmployee).toHaveBeenCalledWith("emp-new")
    expect(mocks.toastError).toHaveBeenCalledWith("employees.create.error")
    expect(mocks.toastSuccess).not.toHaveBeenCalled()
    expect(mocks.toastWarning).not.toHaveBeenCalled()
    expect(mocks.routerPush).not.toHaveBeenCalled()
  })
  it("hydrates the real English name rather than the Arabic display name", () => {
    const form = makeForm(employeeFormData)
    renderHook(() => useEmployeeForm({...baseOptions, isEdit:true, employeeId:"emp-1", employee: {nameEn:"Dana Smith", nameAr:"دانا سميث", user:{firstName:"دانا",lastName:"سميث"},isActive:true} as never, form:form as never}))
    expect(form.reset).toHaveBeenCalledWith(expect.objectContaining({nameEn:"Dana Smith"}))
  })

  it("hydrates an empty persisted schedule with all days disabled", () => {
    const setSchedule = vi.fn()
    renderHook(() => useEmployeeForm({...baseOptions, isEdit:true, availability:[], setSchedule, form:makeForm(employeeFormData) as never}))
    expect(setSchedule).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({dayOfWeek:0,isActive:false})]))
  })

  it("persists explicit removal of all windows and breaks", async () => {
    const {result} = renderHook(() => useEmployeeForm({...baseOptions,isEdit:true,employeeId:"emp-1",availability:[],existingBreaks:[],draftServices:[],form:makeForm(employeeFormData) as never}))
    await act(async () => { await result.current.onSubmit() })
    expect(mocks.setAvailability).toHaveBeenCalledWith({id:"emp-1",schedule:[]})
    expect(mocks.setBreaks).toHaveBeenCalledWith({id:"emp-1",breaks:[]})
  })

  it("removes service links absent from the edited form", async () => {
    const {result} = renderHook(() => useEmployeeForm({...baseOptions,isEdit:true,employeeId:"emp-1",existingServices:[{serviceId:"removed",id:"link",service:null,isActive:true}],draftServices:[],form:makeForm(employeeFormData) as never}))
    await act(async () => { await result.current.onSubmit() })
    expect(mocks.removeEmployeeService).toHaveBeenCalledWith("removed")
  })

  it("does not repeat successful leave or service assignment after a later edit step fails", async () => {
    mocks.setEmployeePricingMode.mockRejectedValueOnce(new Error("pricing failed")).mockResolvedValue(undefined)
    const {result} = renderHook(() => useEmployeeForm({...baseOptions, isEdit:true, employeeId:"emp-1", draftServices:[draftService], existingServices:[], vacation:{enabled:true,startDate:"2026-11-01",endDate:"2026-11-02",reason:"Leave"},form:makeForm(employeeFormData) as never}))
    await act(async () => { await result.current.onSubmit() })
    expect(mocks.routerPush).not.toHaveBeenCalled()
    await act(async () => { await result.current.onSubmit() })
    expect(mocks.createVacation).toHaveBeenCalledTimes(1)
    expect(mocks.assignService).toHaveBeenCalledTimes(1)
    expect(mocks.updateEmployeeService).toHaveBeenCalledTimes(1)
    expect(mocks.routerPush).toHaveBeenCalledWith("/employees")
  })

})
