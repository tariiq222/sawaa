import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

// Reactive URL-state mock for next/navigation. The hook reads search params from
// the URL and writes via router.replace; we simulate that here so useEmployees
// behaves end-to-end in jsdom.
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
  fetchEmployees,
  fetchEmployee,
  fetchAvailability,
  fetchBreaks,
  fetchVacations,
  fetchEmployeeServices,
  fetchEmployeeServiceTypes,
} = vi.hoisted(() => ({
  fetchEmployees: vi.fn(),
  fetchEmployee: vi.fn(),
  fetchAvailability: vi.fn(),
  fetchBreaks: vi.fn(),
  fetchVacations: vi.fn(),
  fetchEmployeeServices: vi.fn(),
  fetchEmployeeServiceTypes: vi.fn(),
}))

vi.mock("@/lib/api/employees", () => ({
  fetchEmployees,
  fetchEmployee,
  fetchAvailability,
  fetchBreaks,
  fetchVacations,
  fetchEmployeeServices,
  fetchEmployeeServiceTypes,
  // mutation fns — not used by query hooks but must be present for the module
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
  useEmployees,
  useEmployee,
  useEmployeeAvailability,
  useEmployeeBreaks,
  useEmployeeVacations,
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

describe("useEmployees", () => {
  beforeEach(() => { vi.clearAllMocks(); navState.reset() })

  it("fetches employees and returns items", async () => {
    const items = [{ id: "p-1", firstName: "Ali", lastName: "Hassan" }]
    fetchEmployees.mockResolvedValueOnce({ items, meta: { total: 1 } })

    const { result } = renderHook(() => useEmployees(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchEmployees).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 20 }),
    )
    expect(result.current.employees).toEqual(items)
    expect(result.current.meta).toEqual({ total: 1 })
  })

  it("setSearch resets page to 1 and passes search to api", async () => {
    fetchEmployees.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useEmployees(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setSearch("Dr. Ali") })

    await waitFor(() =>
      expect(fetchEmployees).toHaveBeenCalledWith(
        expect.objectContaining({ search: "Dr. Ali", page: 1 }),
      ),
    )
  })

  it("setIsActive resets page to 1", async () => {
    fetchEmployees.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useEmployees(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setIsActive(true) })

    await waitFor(() =>
      expect(fetchEmployees).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true, page: 1 }),
      ),
    )
  })

  it("resetFilters clears search, isActive, and resets page", async () => {
    fetchEmployees.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useEmployees(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.setSearch("test")
      result.current.setIsActive(true)
    })

    act(() => { result.current.resetFilters() })

    await waitFor(() => {
      expect(result.current.search).toBe("")
      expect(result.current.isActive).toBeUndefined()
      expect(result.current.page).toBe(1)
    })
  })

  it("hasFilters is true when search is set", async () => {
    fetchEmployees.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useEmployees(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.hasFilters).toBe(false)

    act(() => { result.current.setSearch("Dr.") })

    await waitFor(() => expect(result.current.hasFilters).toBe(true))
  })

  it("hasFilters is true when isActive is set", async () => {
    fetchEmployees.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useEmployees(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setIsActive(false) })

    await waitFor(() => expect(result.current.hasFilters).toBe(true))
  })

  it("returns error message when fetch fails", async () => {
    fetchEmployees.mockRejectedValueOnce(new Error("Network error"))

    const { result } = renderHook(() => useEmployees(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.error).toBe("Network error")
  })

  it("returns null meta when no data", () => {
    fetchEmployees.mockReturnValueOnce(new Promise(() => undefined))

    const { result } = renderHook(() => useEmployees(), { wrapper: makeWrapper() })

    expect(result.current.meta).toBeNull()
    expect(result.current.employees).toEqual([])
  })

  it("passes undefined search when search is empty string", async () => {
    fetchEmployees.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useEmployees(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchEmployees).toHaveBeenCalledWith(
      expect.objectContaining({ search: undefined }),
    )
  })
})

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
