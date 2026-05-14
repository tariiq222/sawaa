import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { fetchActivityLogs } = vi.hoisted(() => ({
  fetchActivityLogs: vi.fn(),
}))

vi.mock("@/lib/api/activity-log", () => ({ fetchActivityLogs }))

import { useActivityLogs } from "@/hooks/use-activity-log"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useActivityLogs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches logs and returns items from data", async () => {
    const items = [{ id: "log-1", module: "bookings", action: "CREATE" }]
    fetchActivityLogs.mockResolvedValueOnce({ items, meta: { total: 1 } })

    const { result } = renderHook(() => useActivityLogs(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchActivityLogs).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 20 }),
    )
    expect(result.current.logs).toEqual(items)
    expect(result.current.meta).toEqual({ total: 1 })
  })

  it("returns pending state while fetching", async () => {
    fetchActivityLogs.mockReturnValueOnce(new Promise(() => undefined))

    const { result } = renderHook(() => useActivityLogs(), { wrapper: makeWrapper() })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.logs).toEqual([])
  })

  it("returns empty logs when api resolves with no items", async () => {
    fetchActivityLogs.mockResolvedValueOnce({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useActivityLogs(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.logs).toEqual([])
    expect(result.current.meta?.total).toBe(0)
  })

  it("passes module and action filters to api", async () => {
    fetchActivityLogs.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useActivityLogs(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    result.current.setModule("payments")
    result.current.setAction("DELETE")

    await waitFor(() =>
      expect(fetchActivityLogs).toHaveBeenCalledWith(
        expect.objectContaining({ module: "payments", action: "DELETE", page: 1 }),
      ),
    )
  })

  it("resetFilters clears all filter state", async () => {
    fetchActivityLogs.mockResolvedValue({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useActivityLogs(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    result.current.setModule("auth")
    await waitFor(() => expect(result.current.module).toBe("auth"))

    result.current.resetFilters()
    await waitFor(() => expect(result.current.module).toBeUndefined())
    expect(result.current.hasFilters).toBe(false)
  })
})
