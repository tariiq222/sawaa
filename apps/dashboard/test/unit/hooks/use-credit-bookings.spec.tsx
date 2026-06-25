import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const {
  fetchMatchingCredits,
  bookFromCredit,
} = vi.hoisted(() => ({
  fetchMatchingCredits: vi.fn(),
  bookFromCredit: vi.fn(),
}))

vi.mock("@/lib/api/credit-bookings", () => ({
  fetchMatchingCredits,
  bookFromCredit,
}))

import {
  useMatchingCredits,
  useBookFromCredit,
} from "@/hooks/use-credit-bookings"

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

describe("useMatchingCredits — gate", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("is disabled when clientId is missing", () => {
    const { result } = renderHook(
      () =>
        useMatchingCredits({
          clientId: "",
          serviceId: "svc-1",
          employeeId: "emp-1",
          durationOptionId: "dur-1",
        }),
      { wrapper: makeWrapper() },
    )
    expect(result.current.isLoading).toBe(false)
    expect(fetchMatchingCredits).not.toHaveBeenCalled()
  })

  it("is disabled when serviceId is missing", () => {
    const { result } = renderHook(
      () =>
        useMatchingCredits({
          clientId: "cl-1",
          serviceId: "",
          employeeId: "emp-1",
          durationOptionId: "dur-1",
        }),
      { wrapper: makeWrapper() },
    )
    expect(result.current.isLoading).toBe(false)
    expect(fetchMatchingCredits).not.toHaveBeenCalled()
  })

  it("is disabled when employeeId is missing", () => {
    const { result } = renderHook(
      () =>
        useMatchingCredits({
          clientId: "cl-1",
          serviceId: "svc-1",
          employeeId: "",
          durationOptionId: "dur-1",
        }),
      { wrapper: makeWrapper() },
    )
    expect(result.current.isLoading).toBe(false)
    expect(fetchMatchingCredits).not.toHaveBeenCalled()
  })

  it("is disabled when durationOptionId is missing", () => {
    const { result } = renderHook(
      () =>
        useMatchingCredits({
          clientId: "cl-1",
          serviceId: "svc-1",
          employeeId: "emp-1",
          durationOptionId: "",
        }),
      { wrapper: makeWrapper() },
    )
    expect(result.current.isLoading).toBe(false)
    expect(fetchMatchingCredits).not.toHaveBeenCalled()
  })

  it("is disabled when the caller explicitly passes enabled=false even with all params", () => {
    const { result } = renderHook(
      () =>
        useMatchingCredits(
          {
            clientId: "cl-1",
            serviceId: "svc-1",
            employeeId: "emp-1",
            durationOptionId: "dur-1",
          },
          false,
        ),
      { wrapper: makeWrapper() },
    )
    expect(result.current.isLoading).toBe(false)
    expect(fetchMatchingCredits).not.toHaveBeenCalled()
  })

  it("fetches and returns matches when all 4 params are present", async () => {
    const rows = [
      { creditId: "cr-1", remaining: 3 },
      { creditId: "cr-2", remaining: 1 },
    ]
    fetchMatchingCredits.mockResolvedValueOnce(rows)
    const { result } = renderHook(
      () =>
        useMatchingCredits({
          clientId: "cl-1",
          serviceId: "svc-1",
          employeeId: "emp-1",
          durationOptionId: "dur-1",
        }),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(fetchMatchingCredits).toHaveBeenCalledWith({
      clientId: "cl-1",
      serviceId: "svc-1",
      employeeId: "emp-1",
      durationOptionId: "dur-1",
    })
    expect(result.current.data).toEqual(rows)
  })
})

describe("useBookFromCredit", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("posts the payload and invalidates bookings + package-purchases on success", async () => {
    bookFromCredit.mockResolvedValueOnce({ id: "bk-new" })
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    // Pre-populate the keys that should be invalidated.
    queryClient.setQueryData(["bookings", "list", {}], { items: [] })
    queryClient.setQueryData(["package-purchases", "client", "cl-1", {}], [])

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    Wrapper.displayName = "Wrapper"

    const { result } = renderHook(() => useBookFromCredit(), { wrapper: Wrapper })

    await result.current.mutateAsync({
      clientId: "cl-1",
      creditId: "cr-1",
      branchId: "br-1",
      scheduledAt: "2026-12-31T09:00:00.000Z",
    })

    expect(bookFromCredit).toHaveBeenCalledWith({
      clientId: "cl-1",
      creditId: "cr-1",
      branchId: "br-1",
      scheduledAt: "2026-12-31T09:00:00.000Z",
    })
    const invalidated = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey)
    expect(
      invalidated.some(
        (k) => Array.isArray(k) && k[0] === "bookings",
      ),
    ).toBe(true)
    expect(
      invalidated.some(
        (k) => Array.isArray(k) && k[0] === "package-purchases",
      ),
    ).toBe(true)
  })
})