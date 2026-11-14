/**
 * Booking Settings API — Sawaa Dashboard
 *
 * Every call goes through the typed helper in `lib/api/openapi.ts`. Response
 * and request shapes are DERIVED from the committed OpenAPI snapshot, so a
 * backend policy change becomes a type error here instead of drifting silently.
 *
 * GET documents `BookingSettingsValuesDto | BookingSettingsRecordResponseDto`:
 * when no global settings row exists the handler answers the built-in defaults,
 * which carry the policy values but no row identity. That is why `id`,
 * `branchId` and the timestamps stay optional below — every reader already
 * used `settings?.field ?? fallback`.
 */

import { openApi } from "@/lib/api/openapi"
import type { components } from "@/lib/types/api.generated"

type Schemas = components["schemas"]

/** Wire vocabulary (Prisma enums as the API sends them). */
export type RefundType = Schemas["RefundType"]
export type ClientCancelCutoffMode = Schemas["ClientCancelCutoffMode"]

/** The policy values, always present on both documented GET shapes. */
export type BookingSettingsValues = Schemas["BookingSettingsValuesDto"]

/** A persisted row (PATCH always returns this). */
export type BookingSettingsRecord = Schemas["BookingSettingsRecordResponseDto"]

/** Dashboard-facing booking settings: the values, plus row identity when persisted. */
export type BookingSettings = BookingSettingsValues &
  Partial<Omit<BookingSettingsRecord, keyof BookingSettingsValues>>

/** The PATCH body as the backend validates it. */
export type UpdateBookingSettingsPayload = Schemas["UpsertBookingSettingsDto"]

export async function fetchBookingSettings(): Promise<BookingSettings> {
  return openApi.get("/api/v1/dashboard/organization/booking-settings")
}

export async function updateBookingSettings(
  data: UpdateBookingSettingsPayload,
): Promise<BookingSettingsRecord> {
  return openApi.patch("/api/v1/dashboard/organization/booking-settings", { body: data })
}
