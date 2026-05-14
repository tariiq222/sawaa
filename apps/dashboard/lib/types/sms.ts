// SaaS-02g-sms — SMS config + delivery types (dashboard).

export type SmsProvider = "NONE" | "UNIFONIC" | "TAQNYAT"

export type SmsDeliveryStatus =
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "FAILED"
  | "UNKNOWN"

export interface SmsConfigView {
  id: string
  organizationId: string
  provider: SmsProvider
  senderId: string | null
  credentialsConfigured: boolean
  lastTestAt: string | null
  lastTestOk: boolean | null
  createdAt: string
  updatedAt: string
}

export interface UnifonicCredentialsInput {
  appSid: string
  apiKey: string
}

export interface TaqnyatCredentialsInput {
  apiToken: string
}

export interface UpsertSmsConfigInput {
  provider: SmsProvider
  senderId?: string
  unifonic?: UnifonicCredentialsInput
  taqnyat?: TaqnyatCredentialsInput
}

export interface TestSmsResult {
  ok: boolean
  providerMessageId?: string
  error?: { ar: string; en: string }
}

export interface SmsDeliveryRow {
  id: string
  provider: SmsProvider
  toPhone: string
  status: SmsDeliveryStatus
  providerMessageId: string | null
  errorMessage: string | null
  sentAt: string | null
  deliveredAt: string | null
  createdAt: string
}
