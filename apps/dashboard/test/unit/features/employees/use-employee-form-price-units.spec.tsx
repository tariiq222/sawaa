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
  assignService: vi.fn(),
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
  }),
}))

vi.mock("@/lib/api/employees", () => ({
  assignService: mocks.assignService,
  setEmployeeServiceOptions: mocks.setEmployeeServiceOptions,
  uploadEmployeeAvatar: mocks.uploadEmployeeAvatar,
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
  useCustomPricing: true,
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
      useCustomOptions: true,
      isActive: true,
      durationOptions: [
        {
          id: "opt-45",
          label: "45 minutes",
          labelAr: "٤٥ دقيقة",
          durationMinutes: 45,
          price: 150,
          isDefault: true,
          sortOrder: 0,
        },
        {
          id: "opt-90",
          label: "90 minutes",
          labelAr: "٩٠ دقيقة",
          durationMinutes: 90,
          price: 300,
          isDefault: false,
          sortOrder: 1,
        },
      ],
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
    mocks.setEmployeeServiceOptions.mockResolvedValue([])
    mocks.assignEmployeeToBranch.mockResolvedValue({ id: "eb-1" })
    mocks.unassignEmployeeFromBranch.mockResolvedValue({ id: "eb-1" })
    mocks.fetchBranches.mockResolvedValue({ items: [{ id: "main-branch", isMain: true }], meta: {} })
  })

  it("converts create employee service prices and duration option prices from SAR to halalas", async () => {
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

    expect(mocks.assignService).toHaveBeenCalledWith(
      "emp-new",
      expect.objectContaining({
        serviceId: "svc-1",
        types: [
          expect.objectContaining({
            deliveryType: "in_person",
            price: 15000,
            durationOptions: [
              expect.objectContaining({ price: 15000 }),
              expect.objectContaining({ price: 30000 }),
            ],
          }),
        ],
      }),
    )
    expect(mocks.setEmployeeServiceOptions).toHaveBeenCalledWith("emp-new", "svc-1", {
      options: [
        expect.objectContaining({
          durationOptionId: "opt-45",
          priceOverride: 15000,
          durationOverride: 45,
          isActive: true,
        }),
        expect.objectContaining({
          durationOptionId: "opt-90",
          priceOverride: 30000,
          durationOverride: 90,
          isActive: true,
        }),
      ],
    })
  })

  it("converts edit employee service prices and duration option prices from SAR to halalas", async () => {
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
            durationOptions: [
              expect.objectContaining({ price: 15000 }),
              expect.objectContaining({ price: 30000 }),
            ],
          }),
        ],
      }),
    })
    expect(mocks.setEmployeeServiceOptions).toHaveBeenCalledWith("emp-1", "svc-1", {
      options: [
        expect.objectContaining({ durationOptionId: "opt-45", priceOverride: 15000 }),
        expect.objectContaining({ durationOptionId: "opt-90", priceOverride: 30000 }),
      ],
    })
  })
})
