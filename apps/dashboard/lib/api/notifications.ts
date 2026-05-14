/**
 * Notifications API — Deqah Dashboard
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Notification,
  NotificationListQuery,
  UnreadCount,
} from "@/lib/types/notification"

/* ─── Queries ─── */

export async function fetchNotifications(
  query: NotificationListQuery = {},
): Promise<PaginatedResponse<Notification>> {
  return api.get<PaginatedResponse<Notification>>("/dashboard/comms/notifications", {
    page: query.page,
    limit: query.perPage,
  })
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await api.get<UnreadCount>(
    "/dashboard/comms/notifications/unread-count",
  )
  return res.count
}

/* ─── Mutations ─── */

export async function markAllAsRead(): Promise<void> {
  await api.patch("/dashboard/comms/notifications/mark-read")
}

export async function markOneAsRead(id: string): Promise<void> {
  await api.patch("/dashboard/comms/notifications/mark-read", { notificationId: id })
}
