/**
 * Clinic API — Deqah Dashboard
 *
 * Working hours and holidays management.
 */

import { api } from "@/lib/api"

/* ─── Types ─── */

export interface OrganizationHour {
  id?: string
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

interface BackendBusinessHour {
  id?: string
  dayOfWeek: number
  startTime: string
  endTime: string
  isOpen?: boolean
  isActive?: boolean
}

export interface OrganizationHoliday {
  id: string
  date: string
  nameAr: string
  nameEn: string | null
  createdAt: string
}

/* ─── Working Hours ─── */

export async function fetchOrganizationHours(branchId: string): Promise<OrganizationHour[]> {
  const rows = await api.get<BackendBusinessHour[]>(`/dashboard/organization/hours/${branchId}`)
  return rows.map((row) => ({
    id: row.id,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    isActive: row.isActive ?? row.isOpen ?? false,
  }))
}

export async function updateOrganizationHours(
  branchId: string,
  hours: Omit<OrganizationHour, "id">[],
): Promise<OrganizationHour[]> {
  const rows = await api.post<BackendBusinessHour[]>("/dashboard/organization/hours", {
    branchId,
    schedule: hours.map(({ dayOfWeek, startTime, endTime, isActive }) => ({
      dayOfWeek,
      startTime,
      endTime,
      isOpen: isActive,
    })),
  })
  return rows.map((row) => ({
    id: row.id,
    dayOfWeek: row.dayOfWeek,
    startTime: row.startTime,
    endTime: row.endTime,
    isActive: row.isActive ?? row.isOpen ?? false,
  }))
}

/* ─── Holidays ─── */

export async function fetchOrganizationHolidays(
  branchId: string,
  year?: number,
): Promise<OrganizationHoliday[]> {
  return api.get<OrganizationHoliday[]>(
    "/dashboard/organization/holidays",
    { branchId, year },
  )
}

export async function createOrganizationHoliday(branchId: string, data: {
  date: string
  nameAr: string
  nameEn: string
}): Promise<OrganizationHoliday> {
  return api.post<OrganizationHoliday>(
    "/dashboard/organization/holidays",
    { branchId, ...data },
  )
}

export async function deleteOrganizationHoliday(id: string): Promise<void> {
  await api.delete(`/dashboard/organization/holidays/${id}`)
}
