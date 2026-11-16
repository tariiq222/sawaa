/**
 * Activity Log Types — Sawaa Dashboard
 *
 * The wire row is derived from the committed OpenAPI snapshot
 * (`OpsActivityLogEntryDto`). The dashboard keeps one local projection —
 * `ActivityLog` — because `lib/api/activity-log.ts` normalises the row for the
 * table: it renames the module, lower-cases the action vocabulary and lifts
 * `oldValues` / `newValues` out of the free-form `metadata` JSON. Those are
 * client-side adaptations of a documented wire row, not extra wire fields, and
 * `test/unit/lib/platform-ops-type-contract.spec.ts` pins both halves.
 */

import type { components } from "@/lib/types/api.generated"
import type { SearchableQuery } from "./common"

type Schemas = components["schemas"]

/* ─── Entities ─── */

/** One raw row of `GET /dashboard/ops/activity`, exactly as the handler projects it. */
export type ActivityLogRow = Schemas["OpsActivityLogEntryDto"]

/** The normalised row the activity table renders (see the module doc above). */
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
  user: ActivityLogRow["user"]
}

/** The list envelope (`OpsActivityLogListResponseDto`) — `items` are normalised. */
export interface ActivityLogListPage {
  items: ActivityLog[]
  meta: Schemas["OpsActivityLogListResponseDto"]["meta"]
}

/* ─── Query ─── */

/**
 * The activity endpoint documents `page`, `limit`, `userId`, `entity`,
 * `entityId`, `action`, `from` and `to`. The dashboard's filter bar speaks its
 * own module/action vocabulary and date-only inputs, so this query keeps those
 * client names and `lib/api/activity-log.ts` maps them onto the wire params.
 */
export interface ActivityLogQuery extends SearchableQuery {
  module?: string
  action?: string
  userId?: string
  dateFrom?: string
  dateTo?: string
}
