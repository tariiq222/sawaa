import { api } from "@/lib/api"
import type {
  TestZoomResult,
  UpsertZoomConfigInput,
  ZoomConfigView,
} from "@/lib/types/zoom"

// Shape returned by the booking Zoom retry endpoint
// (POST /dashboard/bookings/:id/zoom/retry) — the updated booking's
// Zoom fields, per the backend's documented response contract.
export interface RetryZoomMeetingResult {
  id: string
  zoomMeetingId: string | null
  zoomJoinUrl: string | null
  zoomStartUrl: string | null
}

export async function fetchZoomConfig(): Promise<ZoomConfigView> {
  return api.get<ZoomConfigView>("/dashboard/integrations/zoom")
}

export async function upsertZoomConfig(
  input: UpsertZoomConfigInput,
): Promise<ZoomConfigView> {
  return api.put<ZoomConfigView>("/dashboard/integrations/zoom", input)
}

export async function testZoomConfig(
  input: UpsertZoomConfigInput,
): Promise<TestZoomResult> {
  return api.post<TestZoomResult>("/dashboard/integrations/zoom/test", input)
}

export async function retryBookingZoomMeeting(
  bookingId: string,
): Promise<RetryZoomMeetingResult> {
  return api.post<RetryZoomMeetingResult>(
    `/dashboard/bookings/${bookingId}/zoom/retry`,
    {},
  )
}
