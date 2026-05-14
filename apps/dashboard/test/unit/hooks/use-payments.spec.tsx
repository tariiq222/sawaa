import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchPayments,
} = vi.hoisted(() => ({
  fetchPayments: vi.fn(),
}))

vi.mock("@/lib/api/payments", () => ({
  fetchPayments,
}))

import {
  usePayments,
  usePaymentMutations,
} from "@/hooks/use-payments"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("usePayments", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches payments and returns items", async () => {
    const items = [{ id: "pay-1", amount: 500 }]
    fetchPayments.mockResolvedValueOnce({ items, meta: { total: 1 } })

    const { result } = renderHook(() => usePayments(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchPayments).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 20 }),
    )
    expect(result.current.payments).toEqual(items)
    expect(result.current.meta).toEqual({ total: 1 })
  })

  it("returns loading state initially", () => {
    fetchPayments.mockReturnValueOnce(new Promise(() => undefined))

    const { result } = renderHook(() => usePayments(), { wrapper: makeWrapper() })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.payments).toEqual([])
  })

  it("hasFilters is false when no filters are applied", async () => {
    fetchPayments.mockResolvedValueOnce({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => usePayments(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.hasFilters).toBe(false)
  })

  it("hasFilters is true when status filter is applied", async () => {
    fetchPayments.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => usePayments(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setStatus("paid") })

    await waitFor(() => expect(result.current.hasFilters).toBe(true))
  })

  it("resetFilters clears status and method", async () => {
    fetchPayments.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => usePayments(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setStatus("paid") })
    await waitFor(() => expect(result.current.status).toBe("paid"))

    act(() => { result.current.resetFilters() })
    await waitFor(() => expect(result.current.status).toBe("all"))
    expect(result.current.method).toBe("all")
    expect(result.current.hasFilters).toBe(false)
  })

  it("passes search to api and resets page", async () => {
    fetchPayments.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => usePayments(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setSearch("ref-001") })

    await waitFor(() =>
      expect(fetchPayments).toHaveBeenCalledWith(
        expect.objectContaining({ search: "ref-001", page: 1 }),
      ),
    )
  })
})

describe("usePaymentMutations", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("refundMut exists as a stub", () => {
    const { result } = renderHook(() => usePaymentMutations(), { wrapper: makeWrapper() })
    expect(result.current.refundMut).toBeDefined()
    expect(typeof result.current.refundMut.mutateAsync).toBe("function")
  })

  it("verifyMut exists as a stub", () => {
    const { result } = renderHook(() => usePaymentMutations(), { wrapper: makeWrapper() })
    expect(result.current.verifyMut).toBeDefined()
    expect(typeof result.current.verifyMut.mutateAsync).toBe("function")
  })
})
