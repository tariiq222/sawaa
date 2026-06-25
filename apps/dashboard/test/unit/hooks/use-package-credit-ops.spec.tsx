import { renderHook, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { transferCredit, refundPackagePurchase } = vi.hoisted(() => ({
  transferCredit: vi.fn(),
  refundPackagePurchase: vi.fn(),
}))

vi.mock("@/lib/api/package-credit-ops", () => ({
  transferCredit,
  refundPackagePurchase,
}))

import {
  useTransferCredit,
  useRefundPackagePurchase,
} from "@/hooks/use-package-credit-ops"

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useTransferCredit", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("posts the creditId (in the URL) and toEmployeeId (in the body) and invalidates package-purchases on success", async () => {
    transferCredit.mockResolvedValueOnce({ id: "cr-1", employeeId: "emp-2" })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    queryClient.setQueryData(["package-purchases", "client", "cl-1", {}], [])

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    Wrapper.displayName = "Wrapper"

    const { result } = renderHook(() => useTransferCredit(), { wrapper: Wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        creditId: "cr-1",
        payload: { toEmployeeId: "emp-2" },
      })
    })

    expect(transferCredit).toHaveBeenCalledWith("cr-1", {
      toEmployeeId: "emp-2",
    })
    const invalidated = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey)
    expect(
      invalidated.some(
        (k) => Array.isArray(k) && k[0] === "package-purchases",
      ),
    ).toBe(true)
  })
})

describe("useRefundPackagePurchase", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("posts the purchaseId (URL) + refundAmount in halalas + notes and invalidates package-purchases/payments/invoices on success", async () => {
    refundPackagePurchase.mockResolvedValueOnce({
      purchaseId: "pp-1",
      status: "REFUNDED",
      refundAmount: 150000,
      refundedAt: "2026-06-24T00:00:00.000Z",
    })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    // Pre-populate the keys that should be invalidated.
    queryClient.setQueryData(["package-purchases", "client", "cl-1", {}], [])
    queryClient.setQueryData(["payments", "list", {}], { items: [] })
    queryClient.setQueryData(["invoices", "list", {}], { items: [] })

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    Wrapper.displayName = "Wrapper"

    const { result } = renderHook(() => useRefundPackagePurchase(), {
      wrapper: Wrapper,
    })

    await act(async () => {
      await result.current.mutateAsync({
        purchaseId: "pp-1",
        payload: { refundAmount: 150000, notes: "Client moved abroad" },
      })
    })

    expect(refundPackagePurchase).toHaveBeenCalledWith("pp-1", {
      refundAmount: 150000,
      notes: "Client moved abroad",
    })
    const invalidated = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey)
    expect(
      invalidated.some(
        (k) => Array.isArray(k) && k[0] === "package-purchases",
      ),
    ).toBe(true)
    expect(
      invalidated.some((k) => Array.isArray(k) && k[0] === "payments"),
    ).toBe(true)
    expect(
      invalidated.some((k) => Array.isArray(k) && k[0] === "invoices"),
    ).toBe(true)
  })

  it("forwards a refundAmount of 0 (no-money cancellation) without coercion", async () => {
    refundPackagePurchase.mockResolvedValueOnce({
      purchaseId: "pp-2",
      status: "REFUNDED",
      refundAmount: 0,
      refundedAt: "2026-06-24T00:00:00.000Z",
    })
    const { result } = renderHook(() => useRefundPackagePurchase(), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await result.current.mutateAsync({
        purchaseId: "pp-2",
        payload: { refundAmount: 0 },
      })
    })
    const [purchaseId, payload] = refundPackagePurchase.mock.calls[0]
    expect(purchaseId).toBe("pp-2")
    expect(payload.refundAmount).toBe(0)
    expect(payload.notes).toBeUndefined()
  })
})

describe("useRefundPackagePurchase — SAR → halalas conversion contract", () => {
  // This is the form-layer's responsibility (lib/money.sarToHalalas),
  // not the hook's. The hook is a passthrough; the regression
  // coverage here asserts that the hook does NOT add its own
  // conversion (so a future refactor cannot silently break the
  // refund-by-SAR UX by adding a `* 100` somewhere upstream of the
  // wire payload).
  beforeEach(() => { vi.clearAllMocks() })

  it("passes the integer-halalas amount through unchanged to the API", async () => {
    refundPackagePurchase.mockResolvedValueOnce({
      purchaseId: "pp-3",
      status: "REFUNDED",
      refundAmount: 150050, // 1500.50 SAR → 150050 halalas
      refundedAt: "2026-06-24T00:00:00.000Z",
    })
    const { result } = renderHook(() => useRefundPackagePurchase(), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await result.current.mutateAsync({
        purchaseId: "pp-3",
        payload: { refundAmount: 150050 },
      })
    })
    const [, payload] = refundPackagePurchase.mock.calls[0]
    expect(payload.refundAmount).toBe(150050)
    expect(Number.isInteger(payload.refundAmount)).toBe(true)
  })
})
