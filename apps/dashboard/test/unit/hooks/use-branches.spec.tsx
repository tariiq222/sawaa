import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { fetchBranches } = vi.hoisted(() => ({
  fetchBranches: vi.fn(),
}))

vi.mock("@/lib/api/branches", () => ({
  fetchBranches,
}))

import { useBranches } from "@/hooks/use-branches"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useBranches", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches branches and returns items", async () => {
    const items = [{ id: "b-1", name: "Main Branch" }]
    fetchBranches.mockResolvedValueOnce({ items, meta: { total: 1 } })

    const { result } = renderHook(() => useBranches(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchBranches).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 50 }),
    )
    expect(result.current.branches).toEqual(items)
    expect(result.current.meta).toEqual({ total: 1 })
  })

  it("returns loading state initially", () => {
    fetchBranches.mockReturnValueOnce(new Promise(() => undefined))

    const { result } = renderHook(() => useBranches(), { wrapper: makeWrapper() })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.branches).toEqual([])
  })

  it("passes search to api and resets page", async () => {
    fetchBranches.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useBranches(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setSearch("Riyadh") })

    await waitFor(() =>
      expect(fetchBranches).toHaveBeenCalledWith(
        expect.objectContaining({ search: "Riyadh", page: 1 }),
      ),
    )
  })

  it("passes isActive filter to api", async () => {
    fetchBranches.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useBranches(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setIsActive(true) })

    await waitFor(() =>
      expect(fetchBranches).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true, page: 1 }),
      ),
    )
  })

  it("resetFilters clears search and isActive", async () => {
    fetchBranches.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useBranches(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setIsActive(false) })
    await waitFor(() => expect(result.current.isActive).toBe(false))

    act(() => { result.current.resetFilters() })
    await waitFor(() => expect(result.current.isActive).toBeUndefined())
    expect(result.current.search).toBe("")
    expect(result.current.page).toBe(1)
  })
})
