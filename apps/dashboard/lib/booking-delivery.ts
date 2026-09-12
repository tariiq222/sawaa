/**
 * Booking delivery normalization — Sawaa Dashboard
 *
 * The bookings API serializes delivery as a lowercase alias
 * (`in_person` / `online`) while the dashboard type is the enum spelling.
 */

import type { DeliveryType } from "@/lib/types/booking"

export function normalizeDeliveryType(value: string | null | undefined): DeliveryType | null {
  const upper = (value ?? "").toUpperCase()
  return upper === "ONLINE" || upper === "IN_PERSON" ? upper : null
}
