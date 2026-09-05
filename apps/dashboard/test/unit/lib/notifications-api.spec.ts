import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(), patchMock: vi.fn(),
}))
vi.mock("@/lib/api", () => ({ api: { get: getMock, patch: patchMock } }))

import {
  fetchNotifications, fetchUnreadCount, markAllAsRead, markOneAsRead,
} from "@/lib/api/notifications"
import type { Notification } from "@/lib/types/notification"
import type { PaginatedResponse } from "@/lib/types/common"

const notification: Notification = {
  id: "00000000-0000-4000-a000-000000000001", recipientId: "staff-1",
  recipientType: "EMPLOYEE", type: "GENERAL", title: "Reminder", body: "Appointment reminder",
  metadata: null, isRead: false, readAt: null,
  createdAt: "2026-09-05T09:00:00.000Z", updatedAt: "2026-09-05T09:00:00.000Z",
}
const response: PaginatedResponse<Notification> = {
  items: [notification], meta: { total: 21, page: 2, limit: 20, totalPages: 2,
    hasNextPage: false, hasPreviousPage: true },
}

describe("notification API request boundary", () => {
  beforeEach(() => { vi.resetAllMocks() })

  it("omits absent pagination from the request URL", async () => {
    getMock.mockResolvedValueOnce(response)
    expect(await fetchNotifications()).toBe(response)
    expect(getMock).toHaveBeenCalledExactlyOnceWith("/dashboard/comms/notifications")
  })

  it("serializes pagination and preserves the complete envelope including null fields", async () => {
    getMock.mockResolvedValueOnce(response)
    expect(await fetchNotifications({ page: 2, limit: 20 })).toBe(response)
    expect(getMock).toHaveBeenCalledExactlyOnceWith("/dashboard/comms/notifications?page=2&limit=20")
  })

  it("preserves populated metadata and read timestamps", async () => {
    const populated = { ...response, items: [{ ...notification, isRead: true,
      metadata: { bookingId: "booking-1", nested: { labels: ["reminder"] } },
      readAt: "2026-09-05T10:00:00.000Z" }] }
    getMock.mockResolvedValueOnce(populated)
    expect(await fetchNotifications({ limit: 20 })).toBe(populated)
    expect(getMock).toHaveBeenCalledExactlyOnceWith("/dashboard/comms/notifications?limit=20")
  })

  it.each([0, 5])("unwraps unread count %i without a fallback", async (count) => {
    getMock.mockResolvedValueOnce({ count })
    expect(await fetchUnreadCount()).toBe(count)
    expect(getMock).toHaveBeenCalledExactlyOnceWith("/dashboard/comms/notifications/unread-count")
  })

  it("marks all read with the existing empty JSON body and returns void", async () => {
    patchMock.mockResolvedValueOnce(undefined)
    expect(await markAllAsRead()).toBeUndefined()
    expect(patchMock).toHaveBeenCalledExactlyOnceWith("/dashboard/comms/notifications/mark-read", {})
  })

  it("marks only the supplied notification read and returns void", async () => {
    patchMock.mockResolvedValueOnce(undefined)
    expect(await markOneAsRead(notification.id)).toBeUndefined()
    expect(patchMock).toHaveBeenCalledExactlyOnceWith("/dashboard/comms/notifications/mark-read", {
      notificationId: notification.id,
    })
  })

  it.each([
    ["list", () => fetchNotifications()], ["count", () => fetchUnreadCount()],
    ["all read", () => markAllAsRead()], ["one read", () => markOneAsRead(notification.id)],
  ])("propagates %s errors unchanged", async (_name, call) => {
    const error = new Error("Request rejected")
    getMock.mockRejectedValue(error)
    patchMock.mockRejectedValue(error)
    await expect(call()).rejects.toBe(error)
  })
})
