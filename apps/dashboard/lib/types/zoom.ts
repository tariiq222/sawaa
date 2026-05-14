export type ZoomMeetingStatus = "PENDING" | "CREATED" | "FAILED" | "CANCELLED"

export interface ZoomConfigView {
  configured: boolean
  isActive: boolean
}

export interface UpsertZoomConfigInput {
  zoomClientId: string
  zoomClientSecret: string
  zoomAccountId: string
}

export interface TestZoomResult {
  ok: boolean
  error?: string
}
