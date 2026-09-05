/**
 * Notifications API — Sawaa Dashboard
 */

import { openApi } from "@/lib/api/openapi"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Notification,
  NotificationListQuery,
} from "@/lib/types/notification"

/* ─── Queries ─── */

export async function fetchNotifications(
  query: NotificationListQuery = {},
): Promise<PaginatedResponse<Notification>> {
  return openApi.get("/api/v1/dashboard/comms/notifications", {
    query: { page: query.page, limit: query.limit },
  })
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await openApi.get(
    "/api/v1/dashboard/comms/notifications/unread-count",
  )
  return res.count
}

/* ─── Mutations ─── */

export async function markAllAsRead(): Promise<void> {
  await openApi.patch("/api/v1/dashboard/comms/notifications/mark-read", { body: {} })
}

export async function markOneAsRead(id: string): Promise<void> {
  await openApi.patch("/api/v1/dashboard/comms/notifications/mark-read", {
    body: { notificationId: id },
  })
}
