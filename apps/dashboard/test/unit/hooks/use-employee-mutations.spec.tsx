import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  createEmployee,
  onboardEmployee,
  updateEmployee,
  deleteEmployee,
  setAvailability,
  setBreaks,
  createVacation,
  deleteVacation,
  assignService,
  updateEmployeeService,
  removeEmployeeService,
  setEmployeeDurations,
} = vi.hoisted(() => ({
  createEmployee: vi.fn(),
  onboardEmployee: vi.fn(),
  updateEmployee: vi.fn(),
  deleteEmployee: vi.fn(),
  setAvailability: vi.fn(),
  setBreaks: vi.fn(),
  createVacation: vi.fn(),
  deleteVacation: vi.fn(),
  assignService: vi.fn(),
  updateEmployeeService: vi.fn(),
  removeEmployeeService: vi.fn(),
  setEmployeeDurations: vi.fn(),
}))

vi.mock("@/lib/api/employees", () => ({
  createEmployee,
  onboardEmployee,
  updateEmployee,
  deleteEmployee,
  setAvailability,
  setBreaks,
  createVacation,
  deleteVacation,
  assignService,
  updateEmployeeService,
  removeEmployeeService,
  setEmployeeDurations,
  fetchEmployees: vi.fn(),
  fetchEmployee: vi.fn(),
  fetchAvailability: vi.fn(),
  fetchBreaks: vi.fn(),
  fetchVacations: vi.fn(),
  fetchEmployeeServices: vi.fn(),
  fetchEmployeeServiceTypes: vi.fn(),
  fetchSlots: vi.fn(),
  setEmployeeCustomPricing: vi.fn(),
  setEmployeeServiceOptions: vi.fn(),
  createEmployeeAccount: vi.fn(),
  updateEmployeeAccount: vi.fn(),
}))

import {
  useEmployeeMutations,
  useSetAvailability,
  useSetBreaks,
  useVacationMutations,
  useEmployeeServiceMutations,
} from "@/hooks/use-employee-mutations"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useEmployeeMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("createMutation calls createEmployee", async () => {
    createEmployee.mockResolvedValueOnce({ id: "p-new" })

    const { result } = renderHook(() => useEmployeeMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.createMutation.mutate({ firstName: "Ali" } as Parameters<typeof createEmployee>[0])
    })

    await waitFor(() => expect(createEmployee).toHaveBeenCalled())
  })

  it("onboardMutation calls onboardEmployee", async () => {
    onboardEmployee.mockResolvedValueOnce({ id: "p-1" })

    const { result } = renderHook(() => useEmployeeMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.onboardMutation.mutate({ email: "ali@example.com" } as Parameters<typeof onboardEmployee>[0])
    })

    await waitFor(() =>
      expect(onboardEmployee).toHaveBeenCalledWith(
        expect.objectContaining({ email: "ali@example.com" }),
      ),
    )
  })

  it("updateMutation calls updateEmployee with id and payload", async () => {
    updateEmployee.mockResolvedValueOnce({ id: "p-1" })

    const { result } = renderHook(() => useEmployeeMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.updateMutation.mutate({ id: "p-1", firstName: "Updated" } as Parameters<typeof result.current.updateMutation.mutate>[0])
    })

    await waitFor(() =>
      expect(updateEmployee).toHaveBeenCalledWith(
        "p-1",
        expect.objectContaining({ firstName: "Updated" }),
      ),
    )
  })

})

describe("useSetAvailability", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("calls setAvailability with id and payload", async () => {
    setAvailability.mockResolvedValueOnce([])

    const { result } = renderHook(() => useSetAvailability(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate({
        id: "p-1",
        schedule: [],
      } as Parameters<typeof result.current.mutate>[0])
    })

    await waitFor(() =>
      expect(setAvailability).toHaveBeenCalledWith(
        "p-1",
        expect.objectContaining({ schedule: [] }),
      ),
    )
  })
})

describe("useSetBreaks", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("calls setBreaks with id and payload", async () => {
    setBreaks.mockResolvedValueOnce([])

    const { result } = renderHook(() => useSetBreaks(), { wrapper: makeWrapper() })

    act(() => {
      result.current.mutate({
        id: "p-1",
        breaks: [],
      } as Parameters<typeof result.current.mutate>[0])
    })

    await waitFor(() =>
      expect(setBreaks).toHaveBeenCalledWith(
        "p-1",
        expect.objectContaining({ breaks: [] }),
      ),
    )
  })
})

describe("useVacationMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("createMut calls createVacation with employeeId and payload", async () => {
    createVacation.mockResolvedValueOnce({ id: "vac-new" })

    const { result } = renderHook(
      () => useVacationMutations("p-1"),
      { wrapper: makeWrapper() },
    )

    act(() => {
      result.current.createMut.mutate({
        startDate: "2026-04-01",
        endDate: "2026-04-07",
      } as Parameters<typeof createVacation>[1])
    })

    await waitFor(() =>
      expect(createVacation).toHaveBeenCalledWith(
        "p-1",
        expect.objectContaining({ startDate: "2026-04-01" }),
      ),
    )
  })

  it("deleteMut calls deleteVacation with employeeId and vacationId", async () => {
    deleteVacation.mockResolvedValueOnce(undefined)

    const { result } = renderHook(
      () => useVacationMutations("p-1"),
      { wrapper: makeWrapper() },
    )

    act(() => { result.current.deleteMut.mutate("vac-1") })

    await waitFor(() =>
      expect(deleteVacation).toHaveBeenCalledWith("p-1", "vac-1"),
    )
  })
})

describe("useEmployeeServiceMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("assignMut calls assignService with employeeId and payload", async () => {
    assignService.mockResolvedValueOnce({ id: "ps-new" })

    const { result } = renderHook(
      () => useEmployeeServiceMutations("p-1"),
      { wrapper: makeWrapper() },
    )

    act(() => {
      result.current.assignMut.mutate({
        serviceId: "svc-1",
      } as Parameters<typeof assignService>[1])
    })

    await waitFor(() =>
      expect(assignService).toHaveBeenCalledWith(
        "p-1",
        expect.objectContaining({ serviceId: "svc-1" }),
      ),
    )
  })

  it("removeMut calls removeEmployeeService with employeeId and serviceId", async () => {
    removeEmployeeService.mockResolvedValueOnce(undefined)

    const { result } = renderHook(
      () => useEmployeeServiceMutations("p-1"),
      { wrapper: makeWrapper() },
    )

    act(() => { result.current.removeMut.mutate("svc-1") })

    await waitFor(() =>
      expect(removeEmployeeService).toHaveBeenCalledWith("p-1", "svc-1"),
    )
  })

  it("updateMut calls updateEmployeeService with employeeId, serviceId, payload", async () => {
    updateEmployeeService.mockResolvedValueOnce({ id: "ps-1" })

    const { result } = renderHook(
      () => useEmployeeServiceMutations("p-1"),
      { wrapper: makeWrapper() },
    )

    act(() => {
      result.current.updateMut.mutate({
        serviceId: "svc-1",
        payload: { isActive: false },
      })
    })

    await waitFor(() =>
      expect(updateEmployeeService).toHaveBeenCalledWith(
        "p-1",
        "svc-1",
        expect.objectContaining({ isActive: false }),
      ),
    )
  })
})

describe("useEmployeeServiceMutations — durationsMut invalidation", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("invalidates employees.services, services.employees, employees.serviceTypes, employees.practitionerDurations, and services.bookingTypes on success", async () => {
    setEmployeeDurations.mockResolvedValueOnce([])

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    function TestWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    TestWrapper.displayName = "TestWrapper"

    const { result } = renderHook(
      () => useEmployeeServiceMutations("emp-1"),
      { wrapper: TestWrapper },
    )

    act(() => {
      result.current.durationsMut.mutate({
        serviceId: "svc-1",
        payload: { durations: [] },
      })
    })

    await waitFor(() => expect(result.current.durationsMut.isSuccess).toBe(true))

    const calledKeys = invalidateSpy.mock.calls.map(
      ([arg]) => (arg as { queryKey: unknown }).queryKey,
    )

    // employees.practitionerDurations(emp-1, svc-1)
    expect(calledKeys).toContainEqual(
      expect.arrayContaining(["employees", "emp-1", "practitioner-durations", "svc-1"]),
    )

    // services.bookingTypes(svc-1)
    expect(calledKeys).toContainEqual(
      expect.arrayContaining(["services", "svc-1", "booking-types"]),
    )
  })
})

describe("useEmployeeMutations error handling", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("createMutation propagates error", async () => {
    createEmployee.mockRejectedValueOnce(new Error("Email already exists"))

    const { result } = renderHook(() => useEmployeeMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.createMutation.mutate({ email: "dup@clinic.com" } as Parameters<typeof createEmployee>[0])
    })

    await waitFor(() => expect(result.current.createMutation.isError).toBe(true))
    expect(result.current.createMutation.error?.message).toBe("Email already exists")
  })

  it("onboardMutation resolves successfully", async () => {
    onboardEmployee.mockResolvedValueOnce({ id: "p-1" })

    const { result } = renderHook(() => useEmployeeMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.onboardMutation.mutate({ email: "new@clinic.com" } as Parameters<typeof onboardEmployee>[0])
    })

    await waitFor(() => expect(result.current.onboardMutation.isSuccess).toBe(true))
  })
})
