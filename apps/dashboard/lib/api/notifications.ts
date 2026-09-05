/**
 * Notifications API — Sawaa Dashboard
 */

import {
  openApi,
  type OpenApiRequestBody,
  type OpenApiResponse,
} from "@/lib/api/openapi"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Notification,
  NotificationListQuery,
  UnreadCount,
} from "@/lib/types/notification"

type NotificationsPath = "/api/v1/dashboard/comms/notifications"
const MARK_READ_PATH = "/api/v1/dashboard/comms/notifications/mark-read" as const
type MarkReadPath = typeof MARK_READ_PATH
type MarkReadBody = OpenApiRequestBody<MarkReadPath, "patch">
type NotificationsResponse = OpenApiResponse<NotificationsPath, "get">

/* ─── Queries ─── */

export async function fetchNotifications(
  query: NotificationListQuery = {},
): Promise<PaginatedResponse<Notification>> {
  const response: NotificationsResponse = await openApi.get("/api/v1/dashboard/comms/notifications", {
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
