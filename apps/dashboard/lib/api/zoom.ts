/**
 * Zoom integration API — Sawaa Dashboard
 *
 * Every call goes through the typed helper in `lib/api/openapi.ts`, so a
 * renamed route or a changed payload is a type error here. Response types come
 * from the committed OpenAPI snapshot through `lib/types/zoom.ts`.
 * Request URLs, bodies and the returned wire object are unchanged.
 */

import { api } from "@/lib/api"
import { openApi } from "@/lib/api/openapi"
import type {
  RetryZoomMeetingResult,
  TestZoomResult,
  UpsertZoomConfigInput,
  ZoomConfigView,
} from "@/lib/types/zoom"

const ZOOM_CONFIG_PATH = "/api/v1/dashboard/integrations/zoom"

export async function fetchZoomConfig(): Promise<ZoomConfigView> {
  return openApi.get(ZOOM_CONFIG_PATH)
}

export async function upsertZoomConfig(
  input: UpsertZoomConfigInput,
): Promise<ZoomConfigView> {
  return openApi.put(ZOOM_CONFIG_PATH, { body: input })
}

export async function testZoomConfig(
  input: UpsertZoomConfigInput,
): Promise<TestZoomResult> {
  return openApi.post("/api/v1/dashboard/integrations/zoom/test", {
    body: input,
  })
}

/**
 * Booking Zoom retry. This endpoint belongs to the bookings controller, not the
 * integrations one; it stays on the plain client so its body stays an explicit
 * `{}` exactly as before.
 */
export async function retryBookingZoomMeeting(
  bookingId: string,
): Promise<RetryZoomMeetingResult> {
  return api.post<RetryZoomMeetingResult>(
    `/dashboard/bookings/${bookingId}/zoom/retry`,
    {},
  )
}
