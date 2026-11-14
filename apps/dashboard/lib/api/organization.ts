/**
 * Clinic API — Sawaa Dashboard
 *
 * Working hours and holidays management. Every call goes through the typed
 * helper in `lib/api/openapi.ts`, so a renamed route or changed payload is a
 * type error here; the wire shapes come from the committed OpenAPI snapshot.
 */

import { openApi } from "@/lib/api/openapi"
import type { components } from "@/lib/types/api.generated"

type Schemas = components["schemas"]

/* ─── Types (derived from OpenAPI) ─── */

/** A stored business-hour row (`OrganizationHoursRecordDto`). */
export type BusinessHourRecord = Schemas["OrganizationHoursRecordDto"]

/** A stored holiday row (`HolidayRecordDto`). */
type HolidayRecord = Schemas["HolidayRecordDto"]

/**
 * The dashboard's editable weekly grid.
 *
 * The endpoint models openness as `isOpen`; the grid has always edited
 * `isActive`. `fromBusinessHour` maps the two and nothing else.
 */
export interface OrganizationHour {
  id?: string
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

/** Dashboard-facing holiday: the fields of the stored row the dashboard reads. */
export interface OrganizationHoliday {
  id: string
  date: string
  nameAr: string
  nameEn: string | null
  createdAt: string
}

function toHoliday(holiday: HolidayRecord): OrganizationHoliday {
  // Passed through unchanged, as before the types were derived; the row's extra
  // `branchId` is simply not part of the dashboard-facing type.
  return holiday
}

function fromBusinessHour(row: BusinessHourRecord): OrganizationHour {
  return {
    id: row.id,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    // The row carries `isOpen`; the old `row.isActive ??` prefix read a key the
    // wire never sends, so the expression's value is unchanged by dropping it.
    isActive: row.isOpen ?? false,
  }
}

/* ─── Working Hours ─── */

export async function fetchOrganizationHours(branchId: string): Promise<OrganizationHour[]> {
  const rows = await openApi.get("/api/v1/dashboard/organization/hours/{branchId}", {
    path: { branchId },
  })
  return rows.map(fromBusinessHour)
}

export async function updateOrganizationHours(
  branchId: string,
  hours: Omit<OrganizationHour, "id">[],
): Promise<OrganizationHour[]> {
  const rows = await openApi.post("/api/v1/dashboard/organization/hours", {
    body: {
      branchId,
      schedule: hours.map(({ dayOfWeek, startTime, endTime, isActive }) => ({
        dayOfWeek,
        startTime,
        endTime,
        isOpen: isActive,
      })),
    },
  })
  return rows.map(fromBusinessHour)
}

/* ─── Holidays ─── */

export async function fetchOrganizationHolidays(
  branchId: string,
  year?: number,
): Promise<OrganizationHoliday[]> {
  const rows = await openApi.get("/api/v1/dashboard/organization/holidays", {
    query: { branchId, year },
  })
  return rows.map(toHoliday)
}

export async function createOrganizationHoliday(branchId: string, data: {
  date: string
  nameAr: string
  nameEn: string
}): Promise<OrganizationHoliday> {
  const holiday = await openApi.post("/api/v1/dashboard/organization/holidays", {
    body: { branchId, ...data },
  })
  return toHoliday(holiday)
}

export async function deleteOrganizationHoliday(id: string): Promise<void> {
  await openApi.delete("/api/v1/dashboard/organization/holidays/{holidayId}", {
    path: { holidayId: id },
  })
}
