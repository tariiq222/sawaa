import { api } from "@/lib/api"
import type {
  TestZoomResult,
  UpsertZoomConfigInput,
  ZoomConfigView,
} from "@/lib/types/zoom"

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

export async function retryBookingZoomMeeting(bookingId: string): Promise<{ ok: true }> {
  return api.post<{ ok: true }>(`/dashboard/bookings/${bookingId}/zoom/retry`, {})
}
