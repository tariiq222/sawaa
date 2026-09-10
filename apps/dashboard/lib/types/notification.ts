/**
 * Notification Types — Sawaa Dashboard
 */

import type { OpenApiResponse } from "@/lib/api/openapi"
import type { PaginatedQuery } from "./common"

type NotificationsPath = "/api/v1/dashboard/comms/notifications"
type UnreadCountPath = "/api/v1/dashboard/comms/notifications/unread-count"

/* ─── Entities ─── */

export type NotificationWire = OpenApiResponse<NotificationsPath, "get">["items"][number]
export type RecipientType = NotificationWire["recipientType"]
export type NotificationType = NotificationWire["type"]

export type Notification = NotificationWire

/* ─── Query ─── */

export interface NotificationListQuery extends PaginatedQuery {
  unreadOnly?: boolean
}

/* ─── Response ─── */

export type UnreadCount = OpenApiResponse<UnreadCountPath, "get">
