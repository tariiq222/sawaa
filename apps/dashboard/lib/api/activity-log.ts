/**
 * Activity Log API — Deqah Dashboard
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type { ActivityLog, ActivityLogQuery } from "@/lib/types/activity-log"

interface BackendActivityLog {
  id: string
  userId?: string | null
  userEmail?: string | null
  action: string
  entity?: string
  entityId?: string | null
  module?: string
  resourceId?: string | null
  description?: string | null
  metadata?: Record<string, unknown> | null
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
  ipAddress?: string | null
  userAgent?: string | null
  occurredAt?: string | Date | null
  createdAt?: string | Date | null
  user?: ActivityLog["user"]
}

const MODULE_FILTER_TO_ENTITY: Record<string, string> = {
  bookings: "Booking",
  users: "User",
  employees: "Employee",
  payments: "Payment",
  invoices: "Invoice",
  services: "Service",
  roles: "Role",
  branding: "Branding",
  ratings: "Rating",
}

const ACTION_FILTER_TO_BACKEND: Record<string, string> = {
  created: "CREATE",
  updated: "UPDATE",
  deleted: "DELETE",
  login: "LOGIN",
  logout: "LOGOUT",
}

const ACTION_TO_DASHBOARD: Record<string, string> = {
  CREATE: "created",
  UPDATE: "updated",
  DELETE: "deleted",
  LOGIN: "login",
  LOGOUT: "logout",
  EXPORT: "export",
  IMPORT: "import",
  SYSTEM: "system",
}

function normalizeEntityFilter(module: string | undefined): string | undefined {
  if (!module) return undefined
  return MODULE_FILTER_TO_ENTITY[module.toLowerCase()] ?? module
}

function normalizeActionFilter(action: string | undefined): string | undefined {
  if (!action) return undefined
  return ACTION_FILTER_TO_BACKEND[action.toLowerCase()] ?? action
}

function normalizeActionForDashboard(action: string): string {
  return ACTION_TO_DASHBOARD[action.toUpperCase()] ?? action.toLowerCase()
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function toDateString(value: string | Date | null | undefined): string {
  if (value instanceof Date) return value.toISOString()
  return value ?? ""
}

function normalizeActivityLog(log: BackendActivityLog): ActivityLog {
  const metadata = toRecord(log.metadata)

  return {
    id: log.id,
    userId: log.userId ?? null,
    userEmail: log.userEmail ?? log.user?.email ?? null,
    action: normalizeActionForDashboard(log.action),
    module: log.module ?? log.entity ?? "",
    resourceId: log.resourceId ?? log.entityId ?? null,
    description: log.description ?? null,
    oldValues: toRecord(log.oldValues) ?? toRecord(metadata?.oldValues),
    newValues: toRecord(log.newValues) ?? toRecord(metadata?.newValues),
    ipAddress: log.ipAddress ?? null,
    userAgent: log.userAgent ?? null,
    createdAt: toDateString(log.createdAt ?? log.occurredAt),
    user: log.user ?? null,
  }
}

/* ─── Queries ─── */

export async function fetchActivityLogs(
  query: ActivityLogQuery = {},
): Promise<PaginatedResponse<ActivityLog>> {
  const response = await api.get<PaginatedResponse<BackendActivityLog>>("/dashboard/ops/activity", {
    page: query.page,
    limit: query.perPage,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    entity: normalizeEntityFilter(query.module),
    action: normalizeActionFilter(query.action),
    userId: query.userId,
    from: query.dateFrom,
    to: query.dateTo,
  })

  return {
    ...response,
    items: response.items.map(normalizeActivityLog),
  }
}
