/**
 * Waitlist Types — Sawaa Dashboard
 */

// Mirrors the Prisma `WaitlistStatus` enum (apps/backend prisma/schema/bookings.prisma).
export type WaitlistStatus = "WAITING" | "PROMOTED" | "EXPIRED" | "REMOVED"

// Mirrors the row returned by ListWaitlistHandler. Cross-BC relations are
// enriched via batched lookups (no Prisma FK), so each may be null if the
// referenced record was deleted.
export interface WaitlistEntry {
  id: string
  clientId: string
  employeeId: string
  serviceId: string
  branchId: string
  preferredDate: string | null
  status: WaitlistStatus
  promotedAt: string | null
  expiresAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  client: { id: string; name: string; phone: string | null } | null
  employee: { id: string; name: string } | null
  service: { id: string; nameAr: string; nameEn: string | null } | null
}
