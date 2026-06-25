import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchClientPackagePurchases,
  createPackagePurchase,
} = vi.hoisted(() => ({
  fetchClientPackagePurchases: vi.fn(),
  createPackagePurchase: vi.fn(),
}))

vi.mock("@/lib/api/package-purchases", () => ({
  fetchClientPackagePurchases,
  createPackagePurchase,
}))

import {
  useClientPackagePurchases,
  useSellPackage,
} from "@/hooks/use-package-purchases"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useClientPackagePurchases", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("is disabled when clientId is null", () => {
    const { result } = renderHook(() => useClientPackagePurchases(null), {
      wrapper: makeWrapper(),
    })
    expect(result.current.isLoading).toBe(false)
    expect(fetchClientPackagePurchases).not.toHaveBeenCalled()
  })

  it("fetches purchases for the given client and returns the array", async () => {
    const items = [{ id: "pp-1", credits: [] }]
    fetchClientPackagePurchases.mockResolvedValueOnce(items)
    const { result } = renderHook(
      () => useClientPackagePurchases("cl-1"),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchClientPackagePurchases).toHaveBeenCalledWith("cl-1", {})
    expect(result.current.data).toEqual(items)
  })

  it("forwards an optional status filter to the api call", async () => {
    fetchClientPackagePurchases.mockResolvedValueOnce([])
    const { result } = renderHook(
      () => useClientPackagePurchases("cl-1", { status: "REFUNDED" }),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchClientPackagePurchases).toHaveBeenCalledWith("cl-1", {
      status: "REFUNDED",
    })
  })
})

describe("useSellPackage", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("posts the payload and invalidates the package-purchases / payments / invoices keys on success", async () => {
    createPackagePurchase.mockResolvedValueOnce({
      purchase: { id: "pp-new" },
      invoiceId: "inv-new",
      paymentId: "pay-new",
      credits: [],
    })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    // Pre-populate the cache with the relevant keys so we can assert
    // they were marked invalid.
    queryClient.setQueryData(["package-purchases", "client", "cl-1", {}], [])
    queryClient.setQueryData(["payments", "list", {}], { items: [] })
    queryClient.setQueryData(["invoices", "list", {}], { items: [] })

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    Wrapper.displayName = "Wrapper"

    const { result } = renderHook(() => useSellPackage(), { wrapper: Wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        packageId: "pkg-1",
        clientId: "cl-1",
        branchId: "br-1",
        method: "CASH",
      })
    })

    expect(createPackagePurchase).toHaveBeenCalledWith({
      packageId: "pkg-1",
      clientId: "cl-1",
      branchId: "br-1",
      method: "CASH",
    })
    const invalidated = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey)
    expect(invalidated.some((k) => Array.isArray(k) && k[0] === "package-purchases")).toBe(true)
    expect(invalidated.some((k) => Array.isArray(k) && k[0] === "payments")).toBe(true)
    expect(invalidated.some((k) => Array.isArray(k) && k[0] === "invoices")).toBe(true)
  })
})
