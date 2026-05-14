/**
 * Notification Types — Deqah Dashboard
 */

import type { PaginatedQuery } from "./common"

/* ─── Entities ─── */

export type RecipientType = "CLIENT" | "EMPLOYEE"

export interface Notification {
  id: string
  recipientId: string
  recipientType: RecipientType
  type: string
  title: string
  body: string
  metadata: Record<string, unknown> | null
  isRead: boolean
  readAt: string | null
  createdAt: string
  updatedAt: string
}

/* ─── Query ─── */

export type NotificationListQuery = PaginatedQuery

/* ─── Response ─── */

export interface UnreadCount {
  count: number
}
