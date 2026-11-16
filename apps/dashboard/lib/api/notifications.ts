/**
 * Notifications API — Sawaa Dashboard
 *
 * Reads go through the typed helper; the mark-read body is the documented
 * `MarkReadDto`. Response types come from the committed OpenAPI snapshot.
 */

import {
  openApi,
  type OpenApiRequestBody,
} from "@/lib/api/openapi"
import type {
  NotificationList,
  NotificationListQuery,
  UnreadCount,
} from "@/lib/types/notification"

const NOTIFICATIONS_PATH = "/api/v1/dashboard/comms/notifications"
const MARK_READ_PATH = "/api/v1/dashboard/comms/notifications/mark-read" as const
type MarkReadPath = typeof MARK_READ_PATH
type MarkReadBody = OpenApiRequestBody<MarkReadPath, "patch">

/* ─── Queries ─── */

export async function fetchNotifications(
  query: NotificationListQuery = {},
): Promise<NotificationList> {
  const response: NotificationList = await openApi.get(NOTIFICATIONS_PATH, {
    query: {
      page: query.page,
      limit: query.limit,
      unreadOnly: query.unreadOnly,
    },
  })
  return response
}

export async function fetchUnreadCount(): Promise<number> {
  const res: UnreadCount = await openApi.get(
    "/api/v1/dashboard/comms/notifications/unread-count",
  )
  return res.count
}

/* ─── Mutations ─── */

export async function markAllAsRead(): Promise<void> {
  const body: MarkReadBody = {}
  await openApi.patch(MARK_READ_PATH, { body })
}

export async function markOneAsRead(id: string): Promise<void> {
  const body: MarkReadBody = { notificationId: id }
  await openApi.patch(MARK_READ_PATH, { body })
}
