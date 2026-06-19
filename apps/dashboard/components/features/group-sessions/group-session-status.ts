/**
 * Canonical status → Badge variant map for group sessions.
 * Used by both the list page and the detail page so every status
 * maps to the same colour in both views.
 */

import type { GroupSessionStatus } from "@/lib/types/group-session"

export type GroupSessionStatusVariant = "success" | "warning" | "secondary" | "destructive"

export function groupSessionStatusVariant(
  status: GroupSessionStatus,
): GroupSessionStatusVariant {
  switch (status) {
    case "OPEN":      return "success"
    case "FULL":      return "warning"
    case "COMPLETED": return "secondary"
    case "CANCELLED": return "destructive"
  }
}
