import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock, deleteMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
  putMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock, patch: patchMock, delete: deleteMock, put: putMock },
}))

import {
  fetchNotifications,
  fetchUnreadCount,
  markAllAsRead,
} from "@/lib/api/notifications"

describe("notifications api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchNotifications calls /notifications", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: {} })
    await fetchNotifications()
    expect(getMock).toHaveBeenCalledWith("/dashboard/comms/notifications", expect.anything())
  })

  it("fetchUnreadCount calls /notifications/unread-count and returns count", async () => {
    getMock.mockResolvedValueOnce({ count: 5 })
    const result = await fetchUnreadCount()
    expect(getMock).toHaveBeenCalledWith("/dashboard/comms/notifications/unread-count")
    expect(result).toBe(5)
  })

  it("markAllAsRead patches /notifications/read-all", async () => {
    patchMock.mockResolvedValueOnce(undefined)
    await markAllAsRead()
    expect(patchMock).toHaveBeenCalledWith("/dashboard/comms/notifications/mark-read")
  })

})
