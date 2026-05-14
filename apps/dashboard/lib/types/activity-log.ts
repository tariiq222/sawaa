/**
 * Activity Log Types — Deqah Dashboard
 */

import type { SearchableQuery } from "./common"

/* ─── Entities ─── */

export interface ActivityLog {
  id: string
  userId: string | null
  action: string
  module: string
  resourceId: string | null
  description: string | null
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  userEmail: string | null
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
  } | null
}

/* ─── Query ─── */

export interface ActivityLogQuery extends SearchableQuery {
  module?: string
  action?: string
  userId?: string
  dateFrom?: string
  dateTo?: string
}
