/**
 * Activity Log API — Sawaa Dashboard
 *
 * The row shape and the paginated envelope are derived from the committed
 * OpenAPI snapshot (`/dashboard/ops/activity`). The call itself deliberately
 * stays on the plain `api.get(path, params)` transport: the legacy call always
 * appended a bare `?` when every value was undefined, and the typed helper
 * would drop it. Keeping the exact same call is what makes the request
 * byte-identical (verified input-by-input for this function).
 *
 * The response is still normalised for the table (module/action vocabulary +
 * `oldValues` / `newValues` lifted out of the free-form `metadata` JSON, plus
 * the historical `entity` / `entityId` / `occurredAt` fallbacks), so the
 * returned object keeps the exact same keys and values as before.
 */

import { riyadhDayStart, riyadhDayEnd } from "@/lib/audit-date"
import { api } from "@/lib/api"
import type {
  ActivityLog,
  ActivityLogListPage,
  ActivityLogQuery,
  ActivityLogRow,
} from "@/lib/types/activity-log"

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
  export: "EXPORT",
  import: "IMPORT",
  system: "SYSTEM",
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

/**
 * The documented wire row plus the legacy aliases the normaliser has always
 * accepted. `entity` / `entityId` / `occurredAt` / `metadata` are not sent by
 * the current handler (`list-activity.handler.ts` projects `module`,
 * `resourceId` and `createdAt` instead), but the fallbacks below are kept
 * byte-for-byte so no input's result changes — they only ever fired for rows
 * that predate that projection.
 */
type ActivityLogRowWithMetadata = ActivityLogRow & {
  entity?: string
  entityId?: string | null
  occurredAt?: string | Date | null
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function toDateString(value: string | Date | null | undefined): string {
  if (value instanceof Date) return value.toISOString()
  return value ?? ""
}

function normalizeActivityLog(log: ActivityLogRowWithMetadata): ActivityLog {
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
): Promise<ActivityLogListPage> {
  // Transport deliberately stays on the plain client with the params object:
  // the legacy call always appended a bare `?` when every value was undefined
  // (`/dashboard/ops/activity?`), and the typed helper would drop it. Keeping
  // the exact same call is what guarantees the request is byte-identical.
  const response = await api.get<ActivityLogListPage>("/dashboard/ops/activity", {
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy,
    sortOrder: query.sortOrder,
    entity: normalizeEntityFilter(query.module),
    action: normalizeActionFilter(query.action),
    userId: query.userId,
    from: query.dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(query.dateFrom) ? riyadhDayStart(query.dateFrom) : query.dateFrom,
    to: query.dateTo && /^\d{4}-\d{2}-\d{2}$/.test(query.dateTo) ? riyadhDayEnd(query.dateTo) : query.dateTo,
  })

  return {
    ...response,
    items: (response.items as ActivityLogRowWithMetadata[]).map(normalizeActivityLog),
  }
}
