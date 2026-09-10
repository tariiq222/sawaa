import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchPayments,
  fetchPaymentStats,
  collectBookingPayment,
  verifyPayment,
  refundPayment,
  fetchInvoices,
} = vi.hoisted(() => ({
  fetchPayments: vi.fn(),
  fetchPaymentStats: vi.fn(),
  collectBookingPayment: vi.fn(),
  verifyPayment: vi.fn(),
  refundPayment: vi.fn(),
  fetchInvoices: vi.fn(),
}))

vi.mock("@/lib/api/payments", () => ({
  fetchPayments,
  fetchPaymentStats,
  collectBookingPayment,
  verifyPayment,
  refundPayment,
}))

vi.mock("@/lib/api/invoices", () => ({ fetchInvoices }))

import {
  usePayments,
  usePaymentMutations,
  useRecordPaymentMutations,
} from "@/hooks/use-payments"
import { useInvoices } from "@/hooks/use-invoices"

function invoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    number: 1,
    clientId: "client-1",
    bookingId: "booking-1",
    clientName: "Sara Ali",
    subtotal: 10_000,
    vatAmt: 1_500,
    total: 11_500,
    refundedAmount: 0,
    currency: "SAR",
    status: "ISSUED",
    issuedAt: "2026-05-17T10:00:00Z",
    paidAt: null,
    sentToClientAt: null,
    hasPdf: true,
    createdAt: "2026-05-17T09:00:00Z",
    ...overrides,
  }
}

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

  it("resetFilters clears search, dates, status, method, and page", async () => {
    fetchPayments.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => usePayments(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => {
      result.current.setSearch("ref-001")
      result.current.setStatus("COMPLETED")
      result.current.setMethod("CASH")
      result.current.setDateFrom("2026-01-01")
      result.current.setDateTo("2026-01-31")
      result.current.setPage(4)
    })
    await waitFor(() => expect(result.current.status).toBe("COMPLETED"))

    act(() => { result.current.resetFilters() })
    await waitFor(() => expect(result.current.status).toBe("all"))
    expect(result.current.method).toBe("all")
    expect(result.current.search).toBe("")
    expect(result.current.dateFrom).toBe("")
    expect(result.current.dateTo).toBe("")
    expect(result.current.page).toBe(1)
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

  it("refetches an active payments query so the rendered status follows server state", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    fetchPayments
      .mockResolvedValueOnce({
        items: [{ id: "pay-1", amount: 500, status: "PENDING" }],
        meta: { total: 1 },
      })
      .mockResolvedValueOnce({
        items: [{ id: "pay-1", amount: 500, status: "COMPLETED" }],
        meta: { total: 1 },
      })
    verifyPayment.mockResolvedValueOnce({
      id: "pay-1",
      invoiceId: "inv-1",
    })

    const paymentQuery = renderHook(() => usePayments(), { wrapper })
    await waitFor(() => expect(paymentQuery.result.current.isLoading).toBe(false))
    expect(paymentQuery.result.current.payments[0].status).toBe("PENDING")

    const mutation = renderHook(() => usePaymentMutations(), { wrapper })
    await act(async () => {
      await mutation.result.current.verifyMut.mutateAsync({
        id: "pay-1",
        action: "approve",
        invoiceId: "inv-1",
        bookingId: "booking-1",
        clientId: "client-1",
      })
    })

    await waitFor(() => expect(paymentQuery.result.current.payments[0].status).toBe("COMPLETED"))
  })

  it("invalidates booking and client views from known variables with a flat refund response", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const invalidate = vi.spyOn(client, "invalidateQueries")
    refundPayment.mockResolvedValueOnce({
      id: "pay-1",
      invoiceId: "inv-1",
      amount: 12_500,
      refundedAmount: 2_500,
      status: "REFUNDED",
    })

    const mutation = renderHook(() => usePaymentMutations(), { wrapper })
    await act(async () => {
      await mutation.result.current.refundMut.mutateAsync({
        id: "pay-1",
        reason: "Correction",
        invoiceId: "inv-1",
        bookingId: "booking-1",
        clientId: "client-1",
      })
    })

    const keys = invalidate.mock.calls.map(([options]) => options?.queryKey)
    expect(keys).toContainEqual(["bookings", "detail", "booking-1"])
    expect(keys).toContainEqual(["clients", "detail", "client-1"])
    expect(refundPayment).toHaveBeenCalledWith("pay-1", { reason: "Correction", amount: undefined })
  })

  it("updates the mounted payment row with the refunded amount after a flat response", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    fetchPaymentStats.mockResolvedValue({ historical: null })
    fetchPayments
      .mockResolvedValueOnce({
        items: [{ id: "pay-2", invoiceId: "inv-2", amount: 12_500, refundedAmount: 0, status: "COMPLETED" }],
        meta: { total: 1 },
      })
      .mockResolvedValueOnce({
        items: [{ id: "pay-2", invoiceId: "inv-2", amount: 12_500, refundedAmount: 2_500, status: "PARTIALLY_REFUNDED" }],
        meta: { total: 1 },
      })
    refundPayment.mockResolvedValueOnce({
      id: "pay-2",
      invoiceId: "inv-2",
      amount: 12_500,
      refundedAmount: 2_500,
      status: "PARTIALLY_REFUNDED",
    })

    const paymentQuery = renderHook(() => usePayments(), { wrapper })
    await waitFor(() => expect(paymentQuery.result.current.isLoading).toBe(false))
    expect(paymentQuery.result.current.payments[0]).toMatchObject({ refundedAmount: 0 })

    const mutation = renderHook(() => usePaymentMutations(), { wrapper })
    await act(async () => {
      await mutation.result.current.refundMut.mutateAsync({
        id: "pay-2",
        reason: "Correction",
        amount: 2_500,
        invoiceId: "inv-2",
        bookingId: "booking-2",
        clientId: "client-2",
      })
    })

    await waitFor(() => expect(paymentQuery.result.current.payments[0]).toMatchObject({
      amount: 12_500,
      refundedAmount: 2_500,
      status: "PARTIALLY_REFUNDED",
    }))
  })

  it("updates a mounted invoice to PAID with its exact amount after flat verification", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    fetchInvoices
      .mockResolvedValueOnce({ items: [invoiceRow()], meta: { total: 1 } })
      .mockResolvedValueOnce({ items: [invoiceRow({ status: "PAID", total: 12_500 })], meta: { total: 1 } })
    verifyPayment.mockResolvedValueOnce({ id: "pay-1", invoiceId: "inv-1", status: "COMPLETED" })

    const mounted = renderHook(() => ({ invoices: useInvoices(), mutations: usePaymentMutations() }), { wrapper })
    await waitFor(() => expect(mounted.result.current.invoices.invoices[0]).toMatchObject({
      status: "ISSUED",
      totalAmount: 11_500,
    }))

    await act(async () => {
      await mounted.result.current.mutations.verifyMut.mutateAsync({
        id: "pay-1",
        action: "approve",
        invoiceId: "inv-1",
        bookingId: "booking-1",
        clientId: "client-1",
      })
    })

    await waitFor(() => expect(mounted.result.current.invoices.invoices[0]).toMatchObject({
      status: "PAID",
      totalAmount: 12_500,
    }))
  })

  it("updates a mounted invoice to REFUNDED while preserving its exact total", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    fetchInvoices
      .mockResolvedValueOnce({ items: [invoiceRow({ status: "PAID", total: 12_500 })], meta: { total: 1 } })
      .mockResolvedValueOnce({ items: [invoiceRow({ status: "REFUNDED", total: 12_500, refundedAmount: 12_500 })], meta: { total: 1 } })
    refundPayment.mockResolvedValueOnce({
      id: "pay-1",
      invoiceId: "inv-1",
      amount: 12_500,
      refundedAmount: 12_500,
      status: "REFUNDED",
    })

    const mounted = renderHook(() => ({ invoices: useInvoices(), mutations: usePaymentMutations() }), { wrapper })
    await waitFor(() => expect(mounted.result.current.invoices.invoices[0]).toMatchObject({ status: "PAID" }))

    await act(async () => {
      await mounted.result.current.mutations.refundMut.mutateAsync({
        id: "pay-1",
        reason: "Full refund",
        amount: 12_500,
        invoiceId: "inv-1",
        bookingId: "booking-1",
        clientId: "client-1",
      })
    })

    await waitFor(() => expect(mounted.result.current.invoices.invoices[0]).toMatchObject({
      status: "REFUNDED",
      totalAmount: 12_500,
    }))
  })

  it("preserves the mounted invoice amount when the refund API fails", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    fetchInvoices.mockResolvedValueOnce({
      items: [invoiceRow({ status: "PAID", total: 12_500 })],
      meta: { total: 1 },
    })
    refundPayment.mockRejectedValueOnce(new Error("refund rejected"))

    const mounted = renderHook(() => ({ invoices: useInvoices(), mutations: usePaymentMutations() }), { wrapper })
    await waitFor(() => expect(mounted.result.current.invoices.invoices[0]).toMatchObject({ status: "PAID" }))

    await act(async () => {
      await expect(mounted.result.current.mutations.refundMut.mutateAsync({
        id: "pay-1",
        reason: "Rejected refund",
        amount: 2_500,
        invoiceId: "inv-1",
      })).rejects.toThrow("refund rejected")
    })

    expect(mounted.result.current.invoices.invoices[0]).toMatchObject({
      status: "PAID",
      totalAmount: 12_500,
    })
    expect(fetchInvoices).toHaveBeenCalledTimes(1)
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
