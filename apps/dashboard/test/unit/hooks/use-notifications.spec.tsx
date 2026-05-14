import { renderHook, waitFor, act } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const { fetchNotifications, fetchUnreadCount, markAllAsRead } = vi.hoisted(() => ({
  fetchNotifications: vi.fn(),
  fetchUnreadCount: vi.fn(),
  markAllAsRead: vi.fn(),
}))

vi.mock("@/lib/api/notifications", () => ({
  fetchNotifications,
  fetchUnreadCount,
  markAllAsRead,
}))

import {
  useNotifications,
  useDashboardNotifications,
  useUnreadCount,
  useNotificationMutations,
} from "@/hooks/use-notifications"

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function TestWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
  TestWrapper.displayName = "TestWrapper"
  return TestWrapper
}

describe("useNotifications", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fetches notifications list and returns items", async () => {
    const items = [{ id: "n-1", title: "Test", isRead: false }]
    fetchNotifications.mockResolvedValueOnce({ items, meta: { total: 1 } })

    const { result } = renderHook(() => useNotifications(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchNotifications).toHaveBeenCalledWith(expect.objectContaining({ page: 1, perPage: 20 }))
    expect(result.current.notifications).toEqual(items)
  })

  it("returns empty list while loading", () => {
    fetchNotifications.mockReturnValueOnce(new Promise(() => undefined))
    const { result } = renderHook(() => useNotifications(), { wrapper: makeWrapper() })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.notifications).toEqual([])
  })
})

describe("useDashboardNotifications", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fetches with perPage 5", async () => {
    fetchNotifications.mockResolvedValueOnce({ items: [], meta: { total: 0 } })

    const { result } = renderHook(() => useDashboardNotifications(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchNotifications).toHaveBeenCalledWith(expect.objectContaining({ perPage: 5 }))
  })
})

describe("useUnreadCount", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fetches unread count", async () => {
    fetchUnreadCount.mockResolvedValueOnce(7)

    const { result } = renderHook(() => useUnreadCount(), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(fetchUnreadCount).toHaveBeenCalled()
    expect(result.current.data).toBe(7)
  })
})

describe("useNotificationMutations", () => {
  beforeEach(() => vi.clearAllMocks())

  it("markAllMut calls markAllAsRead", async () => {
    markAllAsRead.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useNotificationMutations(), { wrapper: makeWrapper() })

    act(() => { result.current.markAllMut.mutate(undefined) })

    await waitFor(() => expect(markAllAsRead).toHaveBeenCalled())
  })

})
