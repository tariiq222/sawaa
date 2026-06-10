import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { fetchBundles, fetchBundle, createBundle, deleteBundle } = vi.hoisted(() => ({
  fetchBundles: vi.fn(),
  fetchBundle: vi.fn(),
  createBundle: vi.fn(),
  deleteBundle: vi.fn(),
}))

vi.mock("@/lib/api/bundles", () => ({
  fetchBundles,
  fetchBundle,
  createBundle,
  updateBundle: vi.fn(),
  deleteBundle,
}))

import { useBundlesList, useBundle, useBundleMutations } from "@/hooks/use-bundles"

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
  Wrapper.displayName = "Wrapper"
  return { Wrapper, qc }
}

describe("useBundlesList", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches page 1 with includeHidden and no search by default", async () => {
    fetchBundles.mockResolvedValue({ items: [{ id: "bun-1" }], meta: { total: 1 } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBundlesList(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchBundles).toHaveBeenCalledWith({
      page: 1,
      perPage: 20,
      search: undefined,
      isActive: undefined,
      includeHidden: true,
    })
    expect(result.current.bundles).toEqual([{ id: "bun-1" }])
    expect(result.current.meta).toEqual({ total: 1 })
  })

  it("falls back to an empty list and null meta while loading", () => {
    fetchBundles.mockReturnValue(new Promise(() => undefined))
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBundlesList(), { wrapper: Wrapper })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.bundles).toEqual([])
    expect(result.current.meta).toBeNull()
  })

  it("debounces search and refetches with it after resetting to page 1", async () => {
    fetchBundles.mockResolvedValue({ items: [], meta: { total: 0 } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBundlesList(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setPage(4) })
    act(() => { result.current.setSearch("استشارة") })

    // setSearch resets the page synchronously, before the debounce fires
    expect(result.current.page).toBe(1)

    await waitFor(() =>
      expect(fetchBundles).toHaveBeenCalledWith(
        expect.objectContaining({ search: "استشارة", page: 1 }),
      ),
    )
  })

  it("setIsActive filters and resets the page", async () => {
    fetchBundles.mockResolvedValue({ items: [], meta: { total: 0 } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBundlesList(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setPage(2) })
    act(() => { result.current.setIsActive(false) })

    await waitFor(() =>
      expect(fetchBundles).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, page: 1 }),
      ),
    )
  })

  it("resetFilters clears search, filter, and page", async () => {
    fetchBundles.mockResolvedValue({ items: [], meta: { total: 0 } })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBundlesList(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.setSearch("x")
      result.current.setIsActive(true)
      result.current.setPage(3)
    })
    act(() => { result.current.resetFilters() })

    expect(result.current.search).toBe("")
    expect(result.current.isActive).toBeUndefined()
    expect(result.current.page).toBe(1)
  })

  it("surfaces the fetch error message", async () => {
    fetchBundles.mockRejectedValue(new Error("فشل تحميل الباقات"))
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBundlesList(), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.error).toBe("فشل تحميل الباقات"))
    expect(result.current.bundles).toEqual([])
  })
})

describe("useBundle", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("does not fetch when id is null", async () => {
    const { Wrapper } = makeWrapper()
    renderHook(() => useBundle(null), { wrapper: Wrapper })
    await new Promise((r) => setTimeout(r, 0))
    expect(fetchBundle).not.toHaveBeenCalled()
  })

  it("fetches the bundle when an id is provided", async () => {
    fetchBundle.mockResolvedValue({ id: "bun-9" })
    const { Wrapper } = makeWrapper()
    const { result } = renderHook(() => useBundle("bun-9"), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.data).toEqual({ id: "bun-9" }))
    expect(fetchBundle).toHaveBeenCalledWith("bun-9")
  })
})

describe("useBundleMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("createMut invalidates all bundles queries on success", async () => {
    createBundle.mockResolvedValue({ id: "bun-new" })
    const { Wrapper, qc } = makeWrapper()
    const spy = vi.spyOn(qc, "invalidateQueries")
    const { result } = renderHook(() => useBundleMutations(), { wrapper: Wrapper })

    await act(async () => {
      await result.current.createMut.mutateAsync({
        nameAr: "باقة",
        discountType: "FIXED",
        discountValue: 5000,
        serviceIds: ["s-1", "s-2"],
      } as Parameters<typeof result.current.createMut.mutateAsync>[0])
    })

    expect(spy).toHaveBeenCalledWith({ queryKey: ["bundles"], refetchType: "all" })
  })

  it("deleteMut calls deleteBundle with the id and invalidates", async () => {
    deleteBundle.mockResolvedValue(undefined)
    const { Wrapper, qc } = makeWrapper()
    const spy = vi.spyOn(qc, "invalidateQueries")
    const { result } = renderHook(() => useBundleMutations(), { wrapper: Wrapper })

    await act(async () => {
      await result.current.deleteMut.mutateAsync("bun-1")
    })

    expect(deleteBundle.mock.calls[0]?.[0]).toBe("bun-1")
    expect(spy).toHaveBeenCalledWith({ queryKey: ["bundles"], refetchType: "all" })
  })
})
