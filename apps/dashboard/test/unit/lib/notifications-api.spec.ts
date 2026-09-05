import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  patchMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, patch: patchMock },
}))

import {
  fetchNotifications,
  fetchUnreadCount,
  markAllAsRead,
  markOneAsRead,
} from "@/lib/api/notifications"

describe("notifications api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchNotifications returns the list envelope and serializes numeric filters through openApi", async () => {
    const response = {
      items: [{ id: "notification-1" }],
      meta: {
        total: 1,
        page: 2,
        limit: 25,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: true,
      },
    }
    getMock.mockResolvedValueOnce(response)

    await expect(fetchNotifications({ page: 2, limit: 25, unreadOnly: false }))
      .resolves.toEqual(response)

    expect(getMock).toHaveBeenCalledWith(
      "/dashboard/comms/notifications?page=2&limit=25&unreadOnly=false",
    )
  })

  it("fetchUnreadCount calls /notifications/unread-count and returns count", async () => {
    getMock.mockResolvedValueOnce({ count: 5 })
    const result = await fetchUnreadCount()
    expect(getMock).toHaveBeenCalledWith("/dashboard/comms/notifications/unread-count")
    expect(result).toBe(5)
  })

  it("fetchNotifications omits absent query values", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })

    await fetchNotifications()

    expect(getMock).toHaveBeenCalledWith("/dashboard/comms/notifications")
  })

  it("markAllAsRead sends the required empty body and preserves the void result", async () => {
    patchMock.mockResolvedValueOnce(undefined)

    await expect(markAllAsRead()).resolves.toBeUndefined()

    expect(patchMock).toHaveBeenCalledWith(
      "/dashboard/comms/notifications/mark-read",
      {},
    )
  })

  it("markOneAsRead sends the notification id and preserves the void result", async () => {
    patchMock.mockResolvedValueOnce(undefined)

    await expect(markOneAsRead("notification-1")).resolves.toBeUndefined()

    expect(patchMock).toHaveBeenCalledWith(
      "/dashboard/comms/notifications/mark-read",
      { notificationId: "notification-1" },
    )
  })

  it("propagates list, count, and mark-read errors", async () => {
    const listError = new Error("list failed")
    getMock.mockRejectedValueOnce(listError)
    await expect(fetchNotifications()).rejects.toBe(listError)

    const countError = new Error("count failed")
    getMock.mockRejectedValueOnce(countError)
    await expect(fetchUnreadCount()).rejects.toBe(countError)

    const markError = new Error("mark failed")
    patchMock.mockRejectedValueOnce(markError)
    await expect(markOneAsRead("notification-1")).rejects.toBe(markError)
  })

})
