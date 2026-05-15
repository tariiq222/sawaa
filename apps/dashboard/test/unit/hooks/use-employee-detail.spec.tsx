import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const navState = vi.hoisted(() => ({
  params: new URLSearchParams(),
  listeners: new Set<() => void>(),
  notify() { this.listeners.forEach((l) => l()) },
  reset() { this.params = new URLSearchParams(); this.listeners.clear() },
}))

vi.mock("next/navigation", async () => {
  const { useState, useEffect } = await import("react")
  return {
    useRouter: () => ({
      replace: (url: string) => {
        const q = url.indexOf("?")
        navState.params = new URLSearchParams(q >= 0 ? url.slice(q + 1) : "")
        navState.notify()
      },
      push: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      prefetch: vi.fn(),
    }),
    usePathname: () => "/employees",
    useSearchParams: () => {
      const [, force] = useState(0)
      useEffect(() => {
        const fn = () => force((n) => n + 1)
        navState.listeners.add(fn)
        return () => { navState.listeners.delete(fn) }
      }, [])
      return navState.params
    },
  }
})

const {
  fetchEmployee,
  fetchAvailability,
  fetchBreaks,
  fetchVacations,
} = vi.hoisted(() => ({
  fetchEmployee: vi.fn(),
  fetchAvailability: vi.fn(),
  fetchBreaks: vi.fn(),
  fetchVacations: vi.fn(),
}))

vi.mock("@/lib/api/employees", () => ({
  fetchEmployees: vi.fn(),
  fetchEmployee,
  fetchAvailability,
  fetchBreaks,
  fetchVacations,
  fetchEmployeeServices: vi.fn(),
  fetchEmployeeServiceTypes: vi.fn(),
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
  fetchSlots: vi.fn(),
}))

vi.mock("@/hooks/use-employee-mutations", () => ({
  useEmployeeMutations: vi.fn(() => ({})),
  useSetAvailability: vi.fn(() => ({})),
  useSetBreaks: vi.fn(() => ({})),
  useVacationMutations: vi.fn(() => ({})),
  useEmployeeServiceMutations: vi.fn(() => ({})),
}))

import {
  useEmployee,
  useEmployeeAvailability,
  useEmployeeBreaks,
  useEmployeeVacations,
} from "@/hooks/use-employees"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useEmployee", () => {
  beforeEach(() => { vi.clearAllMocks(); navState.reset() })

  it("fetches employee by id", async () => {
    const employee = { id: "p-1", firstName: "Ali" }
    fetchEmployee.mockResolvedValueOnce(employee)

    const { result } = renderHook(() => useEmployee("p-1"), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchEmployee).toHaveBeenCalledWith("p-1")
    expect(result.current.data).toEqual(employee)
  })

  it("does not fetch when id is null", () => {
    renderHook(() => useEmployee(null), { wrapper: makeWrapper() })

    expect(fetchEmployee).not.toHaveBeenCalled()
  })
})

describe("useEmployeeAvailability", () => {
  beforeEach(() => { vi.clearAllMocks(); navState.reset() })

  it("fetches availability when id is provided", async () => {
    const availability = [{ day: "MONDAY", startTime: "09:00" }]
    fetchAvailability.mockResolvedValueOnce(availability)

    const { result } = renderHook(
      () => useEmployeeAvailability("p-1"),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchAvailability).toHaveBeenCalledWith("p-1")
    expect(result.current.data).toEqual(availability)
  })

  it("does not fetch when id is null", () => {
    renderHook(() => useEmployeeAvailability(null), { wrapper: makeWrapper() })
    expect(fetchAvailability).not.toHaveBeenCalled()
  })
})

describe("useEmployeeBreaks", () => {
  beforeEach(() => { vi.clearAllMocks(); navState.reset() })

  it("fetches breaks when id is provided", async () => {
    fetchBreaks.mockResolvedValueOnce([{ id: "br-1" }])

    const { result } = renderHook(
      () => useEmployeeBreaks("p-1"),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchBreaks).toHaveBeenCalledWith("p-1")
  })

  it("does not fetch when id is null", () => {
    renderHook(() => useEmployeeBreaks(null), { wrapper: makeWrapper() })
    expect(fetchBreaks).not.toHaveBeenCalled()
  })
})

describe("useEmployeeVacations", () => {
  beforeEach(() => { vi.clearAllMocks(); navState.reset() })

  it("fetches vacations when id is provided", async () => {
    fetchVacations.mockResolvedValueOnce([{ id: "vac-1" }])

    const { result } = renderHook(
      () => useEmployeeVacations("p-1"),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchVacations).toHaveBeenCalledWith("p-1")
  })

  it("does not fetch when id is null", () => {
    renderHook(() => useEmployeeVacations(null), { wrapper: makeWrapper() })
    expect(fetchVacations).not.toHaveBeenCalled()
  })
})
