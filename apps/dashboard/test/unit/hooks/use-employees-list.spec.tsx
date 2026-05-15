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

const { fetchEmployees } = vi.hoisted(() => ({
  fetchEmployees: vi.fn(),
}))

vi.mock("@/lib/api/employees", () => ({
  fetchEmployees,
  fetchEmployee: vi.fn(),
  fetchAvailability: vi.fn(),
  fetchBreaks: vi.fn(),
  fetchVacations: vi.fn(),
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

import { useEmployees } from "@/hooks/use-employees"

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
