import { apiRequest } from '../client'

export interface ZoomConfigView {
  configured: boolean
  active: boolean
}

export interface UpsertZoomConfigPayload {
  accountId: string
  clientId: string
  clientSecret: string
  active?: boolean
}

export interface TestZoomConfigResult {
  ok: boolean
  error?: string
}

export async function getConfig(): Promise<ZoomConfigView> {
  return apiRequest<ZoomConfigView>('/dashboard/integrations/zoom')
}

export async function upsertConfig(
  payload: UpsertZoomConfigPayload,
): Promise<ZoomConfigView> {
  return apiRequest<ZoomConfigView>('/dashboard/integrations/zoom', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function testConfig(
  payload: UpsertZoomConfigPayload,
): Promise<TestZoomConfigResult> {
  return apiRequest<TestZoomConfigResult>('/dashboard/integrations/zoom/test', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
