import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchPayments,
  fetchPaymentStats,
  collectBookingPayment,
} = vi.hoisted(() => ({
  fetchPayments: vi.fn(),
  fetchPaymentStats: vi.fn(),
  collectBookingPayment: vi.fn(),
}))

vi.mock("@/lib/api/payments", () => ({
  fetchPayments,
  fetchPaymentStats,
  collectBookingPayment,
}))

import {
  usePayments,
  usePaymentMutations,
  useRecordPaymentMutations,
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
  beforeEach(() => {
    vi.clearAllMocks()
    fetchPaymentStats.mockResolvedValue({ historical: null })
  })

  it("fetches payments and returns items", async () => {
    const items = [{ id: "pay-1", amount: 500 }]
    fetchPayments.mockResolvedValueOnce({ items, meta: { total: 1 } })

    const { result } = renderHook(() => usePayments(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchPayments).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 }),
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

    act(() => { result.current.setStatus("COMPLETED") })

    await waitFor(() => expect(result.current.hasFilters).toBe(true))
  })

  it("resetFilters clears status and method", async () => {
    fetchPayments.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => usePayments(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => { result.current.setStatus("COMPLETED") })
    await waitFor(() => expect(result.current.status).toBe("COMPLETED"))

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

describe("useRecordPaymentMutations.collectMut", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("collectMut exists and exposes mutateAsync", () => {
    const { result } = renderHook(() => useRecordPaymentMutations(), { wrapper: makeWrapper() })
    expect(result.current.collectMut).toBeDefined()
    expect(typeof result.current.collectMut.mutateAsync).toBe("function")
  })

  it("calls collectBookingPayment with bookingId and payload, then invalidates bookings + payments + invoices", async () => {
    const apiResult = {
      bookingId: "bk-42",
      invoice: { id: "inv-42", subtotal: 0, vatRate: 0, total: 2500, outstanding: 0, status: "PAID" },
      payment: { id: "pay-42", amount: 2500, method: "CASH", status: "COMPLETED" },
    }
    collectBookingPayment.mockResolvedValueOnce(apiResult)

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    function TestWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    TestWrapper.displayName = "TestWrapper"

    const { result } = renderHook(() => useRecordPaymentMutations(), { wrapper: TestWrapper })

    const payload = {
      bookingId: "bk-42",
      method: "CASH" as const,
      amount: 2500,
      discountAmt: 0,
      discountReasonId: "reason-9",
      note: "Paid at reception",
      idempotencyKey: "idem-xyz",
    }

    await act(async () => {
      const response = await result.current.collectMut.mutateAsync(payload)
      expect(response).toBe(apiResult)
    })

    expect(collectBookingPayment).toHaveBeenCalledWith("bk-42", {
      method: "CASH",
      amount: 2500,
      discountAmt: 0,
      discountReasonId: "reason-9",
      note: "Paid at reception",
      idempotencyKey: "idem-xyz",
    })

    const calledKeys = invalidateSpy.mock.calls.map(
      ([arg]) => (arg as { queryKey: unknown }).queryKey,
    )
    expect(calledKeys).toContainEqual(expect.arrayContaining(["bookings"]))
    expect(calledKeys).toContainEqual(expect.arrayContaining(["payments"]))
    expect(calledKeys).toContainEqual(expect.arrayContaining(["invoices"]))
  })

  it("keeps applyDiscountMut, recordMut, and ensureInvoiceMut exported alongside collectMut", () => {
    const { result } = renderHook(() => useRecordPaymentMutations(), { wrapper: makeWrapper() })
    expect(result.current.applyDiscountMut).toBeDefined()
    expect(result.current.recordMut).toBeDefined()
    expect(result.current.ensureInvoiceMut).toBeDefined()
    expect(result.current.collectMut).toBeDefined()
  })
})
