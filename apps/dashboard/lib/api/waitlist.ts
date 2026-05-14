/**
 * Waitlist API — Deqah Dashboard
 */

import { api } from "@/lib/api"
import type { WaitlistEntry } from "@/lib/types/waitlist"

interface WaitlistQuery {
  [key: string]: string | number | boolean | undefined
  employeeId?: string
  status?: string
}

/** Admin: list all waitlist entries */
export async function fetchWaitlist(
  query?: WaitlistQuery,
): Promise<WaitlistEntry[]> {
  return api.get<WaitlistEntry[]>(
    "/dashboard/bookings/waitlist",
    query,
  )
}

/** Admin: add to waitlist — POST /dashboard/bookings/waitlist */
export interface AddToWaitlistPayload {
  clientId: string
  serviceId: string
  employeeId?: string
  branchId?: string
  preferredDate?: string
}

export async function addToWaitlist(payload: AddToWaitlistPayload): Promise<WaitlistEntry> {
  return api.post<WaitlistEntry>("/dashboard/bookings/waitlist", payload)
}

/** Admin: remove a waitlist entry */
export async function removeWaitlistEntry(id: string): Promise<void> {
  await api.delete(`/dashboard/bookings/waitlist/${id}`)
}
