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
  fetchEmployeeServices,
  fetchEmployeeServiceTypes,
} = vi.hoisted(() => ({
  fetchEmployeeServices: vi.fn(),
  fetchEmployeeServiceTypes: vi.fn(),
}))

vi.mock("@/lib/api/employees", () => ({
  fetchEmployees: vi.fn(),
  fetchEmployee: vi.fn(),
  fetchAvailability: vi.fn(),
  fetchBreaks: vi.fn(),
  fetchVacations: vi.fn(),
  fetchEmployeeServices,
  fetchEmployeeServiceTypes,
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
  useEmployeeServices,
  useEmployeeServiceTypes,
} from "@/hooks/use-employees"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useEmployeeServices", () => {
  beforeEach(() => { vi.clearAllMocks(); navState.reset() })

  it("fetches services when id is provided", async () => {
    fetchEmployeeServices.mockResolvedValueOnce([{ id: "svc-1" }])

    const { result } = renderHook(
      () => useEmployeeServices("p-1"),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchEmployeeServices).toHaveBeenCalledWith("p-1")
  })

  it("does not fetch when id is null", () => {
    renderHook(() => useEmployeeServices(null), { wrapper: makeWrapper() })
    expect(fetchEmployeeServices).not.toHaveBeenCalled()
  })
})

describe("useEmployeeServiceTypes", () => {
  beforeEach(() => { vi.clearAllMocks(); navState.reset() })

  it("fetches service types when both ids are provided", async () => {
    fetchEmployeeServiceTypes.mockResolvedValueOnce([{ bookingType: "IN_PERSON" }])

    const { result } = renderHook(
      () => useEmployeeServiceTypes("p-1", "svc-1"),
      { wrapper: makeWrapper() },
    )

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchEmployeeServiceTypes).toHaveBeenCalledWith("p-1", "svc-1")
  })

  it("does not fetch when either id is null", () => {
    renderHook(
      () => useEmployeeServiceTypes(null, "svc-1"),
      { wrapper: makeWrapper() },
    )
    expect(fetchEmployeeServiceTypes).not.toHaveBeenCalled()
  })
})
