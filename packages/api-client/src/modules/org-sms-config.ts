import { apiRequest } from '../client'

export type SmsProvider = 'UNIFONIC' | 'TAQNYAT'

export interface OrgSmsConfigView {
  provider: SmsProvider | null
  senderName: string | null
  configured: boolean
  active: boolean
  webhookConfigured: boolean
}

export interface UpsertOrgSmsConfigPayload {
  provider: SmsProvider
  senderName: string
  active?: boolean
  credentials: Record<string, string>
  webhookSecret?: string
}

export interface TestSmsConfigPayload {
  to: string
  text: string
}

export interface TestSmsConfigResult {
  ok: boolean
  providerMessageId?: string
  error?: string
}

export interface SmsDeliveryRow {
  id: string
  provider: SmsProvider
  to: string
  status: string
  providerMessageId: string | null
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
  deliveredAt: string | null
}

export async function getConfig(): Promise<OrgSmsConfigView> {
  return apiRequest<OrgSmsConfigView>('/dashboard/comms/settings/sms')
}

export async function upsertConfig(
  payload: UpsertOrgSmsConfigPayload,
): Promise<OrgSmsConfigView> {
  return apiRequest<OrgSmsConfigView>('/dashboard/comms/settings/sms', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function testConfig(
  payload: TestSmsConfigPayload,
): Promise<TestSmsConfigResult> {
  return apiRequest<TestSmsConfigResult>('/dashboard/comms/settings/sms/test', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function listDeliveries(): Promise<SmsDeliveryRow[]> {
  return apiRequest<SmsDeliveryRow[]>(
    '/dashboard/comms/settings/sms/deliveries',
  )
}
