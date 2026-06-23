/**
 * useTopPerformers — TanStack Query hook unit tests.
 *
 * Contract under test:
 *   - useTopPerformers: simple read query under
 *     ['dashboard','top-performers'] with a 5-minute staleTime. Returns the
 *     response data verbatim (no transformation).
 *   - It exposes loading/error state from the underlying query so the
 *     dashboard-home section can render skeletons / error banners.
 */

import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { fetchTopPerformers } = vi.hoisted(() => ({
  fetchTopPerformers: vi.fn(),
}))

vi.mock("@/lib/api/dashboard-stats", () => ({
  fetchTopPerformers,
}))

import { useTopPerformers } from "@/hooks/use-top-performers"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useTopPerformers", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetches top performers under ['dashboard','top-performers']", async () => {
    const top = [
      {
        employeeId: "e-1",
        displayName: "Sara",
        avatarUrl: null,
        bookingsCount: 25,
        revenue: 5000,
      },
    ]
    fetchTopPerformers.mockResolvedValueOnce(top)

    const { result } = renderHook(() => useTopPerformers(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchTopPerformers).toHaveBeenCalledTimes(1)
    expect(result.current.data).toEqual(top)
  })

  it("returns an empty list when the api returns []", async () => {
    fetchTopPerformers.mockResolvedValueOnce([])

    const { result } = renderHook(() => useTopPerformers(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.data).toEqual([])
  })

  it("propagates api errors", async () => {
    fetchTopPerformers.mockRejectedValueOnce(new Error("Network down"))

    const { result } = renderHook(() => useTopPerformers(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(Error)
    expect((result.current.error as Error).message).toBe("Network down")
  })
})
