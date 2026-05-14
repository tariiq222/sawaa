import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} = vi.hoisted(() => ({
  fetchCoupons: vi.fn(),
  createCoupon: vi.fn(),
  updateCoupon: vi.fn(),
  deleteCoupon: vi.fn(),
}))

vi.mock("@/lib/api/coupons", () => ({
  fetchCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
}))

import { useCoupons, useCouponMutations } from "@/hooks/use-coupons"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useCoupons", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches coupons and returns items", async () => {
    const items = [{ id: "c-1", code: "SAVE10" }]
    fetchCoupons.mockResolvedValueOnce({ items, meta: { total: 1 } })

    const { result } = renderHook(() => useCoupons(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchCoupons).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 20 }),
    )
    expect(result.current.coupons).toEqual(items)
    expect(result.current.meta).toEqual({ total: 1 })
  })

  it("returns loading state initially", () => {
    fetchCoupons.mockReturnValueOnce(new Promise(() => undefined))

    const { result } = renderHook(() => useCoupons(), { wrapper: makeWrapper() })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.coupons).toEqual([])
  })

  it("returns empty coupons when api returns no items", async () => {
    fetchCoupons.mockResolvedValueOnce({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useCoupons(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.coupons).toEqual([])
  })

  it("passes search to api and resets page", async () => {
    fetchCoupons.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useCoupons(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setSearch("SUMMER") })

    await waitFor(() =>
      expect(fetchCoupons).toHaveBeenCalledWith(
        expect.objectContaining({ search: "SUMMER", page: 1 }),
      ),
    )
  })

  it("passes status filter to api and resets page", async () => {
    fetchCoupons.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useCoupons(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setStatus("active") })

    await waitFor(() =>
      expect(fetchCoupons).toHaveBeenCalledWith(
        expect.objectContaining({ status: "active", page: 1 }),
      ),
    )
  })

  it("resetFilters clears search and status", async () => {
    fetchCoupons.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useCoupons(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setStatus("expired") })
    await waitFor(() => expect(result.current.status).toBe("expired"))

    act(() => { result.current.resetFilters() })
    await waitFor(() => expect(result.current.status).toBeUndefined())
    expect(result.current.search).toBe("")
    expect(result.current.page).toBe(1)
  })
})

describe("useCouponMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("createMut calls createCoupon", async () => {
    createCoupon.mockResolvedValueOnce({ id: "c-new" })

    const { result } = renderHook(() => useCouponMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.createMut.mutate({ code: "NEW20", discount: 20 } as Parameters<typeof createCoupon>[0])
    })

    await waitFor(() => expect(createCoupon).toHaveBeenCalled())
  })

  it("updateMut calls updateCoupon with id and payload", async () => {
    updateCoupon.mockResolvedValueOnce({ id: "c-1" })

    const { result } = renderHook(() => useCouponMutations(), { wrapper: makeWrapper() })

    act(() => {
      result.current.updateMut.mutate({ id: "c-1", discount: 30 } as Parameters<typeof result.current.updateMut.mutate>[0])
    })

    await waitFor(() => expect(updateCoupon).toHaveBeenCalledWith("c-1", expect.objectContaining({ discount: 30 })))
  })

  it("deleteMut calls deleteCoupon with id", async () => {
    deleteCoupon.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useCouponMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.deleteMut.mutate("c-1") })

    await waitFor(() => expect(deleteCoupon).toHaveBeenCalledWith("c-1", expect.anything()))
  })
})
